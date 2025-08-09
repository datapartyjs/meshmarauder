const debug = require('debug')('marauder.topics.packet-topic')

const ITopic = require('@dataparty/api/src/service/itopic')

class PacketTopic extends ITopic {

  constructor({context}){
    super({context})
  }

  static get Name(){
    return '/packets'
  }

  static get Description(){
    return 'packet topic'
  }

  async canAdvertise(identity, args){
    
    return false
  }

  async canPublish(identity, args){
    
    return false
  }

  async canSubscribe(identity, args){
    return true
  }

}


module.exports = PacketTopic
