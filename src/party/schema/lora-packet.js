
'use strict'

const ISchema = require('@dataparty/api/src/bouncer/ischema')


class LoraPacket extends ISchema {

  static get Type () { return 'lora_packet' }

  static get Schema(){
    return {
      created: {
        type: Date,
        default:  (new Date()).toISOString(),
        required: true
      },

      room: {type: String, required: true, index: true},

      content: {type: String, required: true}     //encrypted JSON Blob of original encrypted payload
    }
  }

  static setupSchema(schema){
    return schema
  }

  static permissions (context) {
    return {
      read: true,
      new: true,
      change: true
    }
  }
}


module.exports = LoraPacket
