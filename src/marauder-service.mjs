import * as DatapartySrv from '@dataparty/api/src/service/index.js'
import * as Path from 'path'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);
import * as Debug from 'debug'
const debug = Debug.default('marauder.service')

export class MarauderService extends DatapartySrv.IService {
  constructor(opts){
    super(opts)


    this.addMiddleware(DatapartySrv.middleware_paths.pre.decrypt)
    this.addMiddleware(DatapartySrv.middleware_paths.pre.validate)

    this.addMiddleware(DatapartySrv.middleware_paths.post.validate)
    this.addMiddleware(DatapartySrv.middleware_paths.post.encrypt)

    this.addEndpoint(DatapartySrv.endpoint_paths.identity)
    this.addEndpoint(DatapartySrv.endpoint_paths.version)

    
    this.addSchema(Path.join(__dirname, './party/schema/lora-packet.js'))

    this.addTopic(Path.join(__dirname, './party/topics/packet-topic.js'))


  }

}
