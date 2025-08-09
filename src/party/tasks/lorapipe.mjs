import * as Debug from 'debug'
const debug = Debug.default('marauder.task.lorapipe')
import * as ITask from '@dataparty/api/src/service/itask.js'


import { spawn } from 'node:child_process'

import { parseInputPacket, CHANNELS } from '../../utils.mjs'
import { LorapipeRawPacket } from '../../lorapipe-raw-packet.mjs'


export class LorapipeTask extends ITask.default {

  constructor(options){
    super({
      name: LorapipeTask.name,
      background: LorapipeTask.Config.background,
      ...options
    })

    debug('new')

    this.child = null
    this.args = options.args


    this.duration = 5000
    this.timeout = null
  }

  static get Config(){
    return {
      background: true,
      autostart: false
    }
  }
 
  async exec(){

    this.setTimer()

    console.log('ctx args',this.context.args)

    this.context.party.topics.getTopic('/packets')

    this.child = spawn('./bin/lora-scanner', this.context.args, {
      shell: '/bin/bash'
    })

    this.child.stdout.on('data', (data) => {


      console.log(`stdout: ${data}`);
      let meta = null
      let line = data.toString()

      if(line.indexOf('RX') != -1){
        let { seen, rssi, snr, raw } = parseInputPacket(line)

        let pkt = new LorapipeRawPacket(seen, rssi, snr, raw, CHANNELS)

        this.emit('packet', pkt)
        //this.context.party.topics.publishInternal('/packets', {line:data})
      }
    });

    this.child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    this.child.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });

    return this.detach()
  }

  setTimer(){
    this.timeout = setTimeout(this.onTimeout.bind(this), this.duration)
  }
 
  onTimeout(){
    this.timeout = null
    
    this.context.serviceRunner.taskRunner.printTaskLists()
    debug('sleep complete')
    console.log('sleep done')

    this.setTimer()
  }
 
  stop(){
    if(this.timeout !== null){
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  static get Name(){
    return 'lorapipe'
  }

  static get Description(){
    return 'lorapipe'
  }
}
