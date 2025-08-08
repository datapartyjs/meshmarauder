import * as Debug from 'debug'
const debug = Debug.default('marauder.task.lorapipe')
import * as ITask from '@dataparty/api/src/service/itask.js'


export class LorapipeTask extends ITask.default {

  constructor(options){
    super({
      name: LorapipeTask.name,
      background: LorapipeTask.Config.background,
      ...options
    })

    debug('new')

    this.duration = 5000
    this.timeout = null
  }

  static get Config(){
    return {
      background: true,
      autostart: true
    }
  }
 
  async exec(){

    this.setTimer()

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
