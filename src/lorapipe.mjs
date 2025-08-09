import { open } from 'node:fs/promises';

export class Lorapipe extends EventEmitter {


  constructor(pathOrStream, readonly=true){
    //
    this.path = null
    this.stream = null
  }

  async start(){

  }

  async stop(){

  }


  async doSend(){

  }

  async setClock(){

  }

}