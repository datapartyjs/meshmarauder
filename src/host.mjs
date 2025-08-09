import * as Path from 'path'
import * as Debug from 'debug'
const debug = Debug.default('marauder.host')
import * as DatapartyLib from '@dataparty/api/src/index.js'


import { MarauderService } from './marauder-service.mjs'

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

const Dataparty=DatapartyLib.default

import { LorapipeTask } from './party/tasks/lorapipe.mjs'

function addNativeTask(service, TaskClass){
    const name = TaskClass.Name
    service.constructors.tasks[name] = TaskClass
}

async function main(){

  const uri = 'mongodb://127.0.0.1:27017/marauder'
  debug('db location', uri)


  const service = new MarauderService({ name: 'meshmaruader', version: '0.0.1' })
  const build = await service.compile(Path.join(__dirname,'../dataparty'), true)

  addNativeTask(service, LorapipeTask )

  debug('compiled')


  let party = new Dataparty.MongoParty({
    uri,
    model: build,
    config: new Dataparty.Config.MemoryConfig(),
    serverModels: {} //this is a hack to workaround a bug
  })

  party.topics = new Dataparty.LocalTopicHost()

  const dbPath = 'dataparty-venue.db'

  debug('party db location', dbPath)

  /*let party = new Dataparty.LocalParty({
    path: dbPath,
    model: build.schemas,
    config: new Dataparty.Config.MemoryConfig()
  })*/



  debug('partying')

  const runner = new Dataparty.ServiceRunnerNode({
    party, service,
    sendFullErrors: true,
    useNative: true
  })
  
  const host = new Dataparty.ServiceHost({runner, trust_proxy: true})

  await party.start()
  await runner.start()
  await host.start()

  //await runner.loadTask('lorapipe')
  runner.tasks[LorapipeTask.Name] = LorapipeTask
  
  let pipeTask = await runner.spawnTask('lorapipe', {
    args: ['-D','/dev/tty_lorapipe0', '-p', '917.25,500,7,8,2b']
  })

  pipeTask.on('line', line=>{
    console.log('line -', line.toString())
  })

  console.log('started')
  
  //process.exit()
}



main().catch(err=>{
  console.error(err)
})
