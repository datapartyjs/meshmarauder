
import {fromBinary, toBinary} from '@bufbuild/protobuf'
import * as protobufs from '@meshtastic/protobufs'
import { UINT32_MAX } from '@bufbuild/protobuf/wire'

import { ed25519 } from '@noble/curves/ed25519.js';
import hkdf from '@panva/hkdf'


import {tryDecryptChannelPacket, PortNumToProtoBuf, CHANNELS} from './utils.mjs'

export class LorapipeRawPacket {

  /**
   * 
   * @param {Number} seen timestamp 
   * @param {Number} rssi 
   * @param {Number} snr 
   * @param {Uint8Array} raw 
   */
  constructor(seen, rssi, snr, raw, channels=CHANNELS){
    this.meta = { seen, rssi, snr }

    this.header = { }

    this.parsed = {}

    if(raw.length == 0) {throw new Error('packet empty') }


    this.short = false
    let view = new DataView(raw.buffer)


    if(raw.length >= 4){ this.header.to = view.getUint32(0) } else {this.short=true}
    if(raw.length >= 8) { this.header.from = view.getUint32(4) } else {this.short=true}
    if(raw.length >= 12) { this.header.id = view.getUint32(8) } else {this.short=true}
    if(raw.length >= 13) { 
      this.header.flagsByte = view.getUint8(12)
      this.header.flags = {
        hop_limit: this.header.flagsByte & 0x7,
        want_ack: (this.header.flagsByte & 0x8) >> 3,
        via_mqtt: (this.header.flagsByte & 0x10) >> 4,
        hop_start:(this.header.flagsByte & 0xE0) >> 5

      }
    } else {this.short=true}
    if(raw.length >= 14) { this.header.channel = view.getUint8(13) } else {this.short=true}
    if(raw.length >= 15) { this.header.next_hop = view.getUint8(14) } else {this.short=true}
    if(raw.length >= 16) { this.header.relay_node = view.getUint8(15) } else {this.short=true}

    

    if(this.header.to != UINT32_MAX){
      this.parsed.is_dm = true
    } else {
      this.parsed.is_broadcast = true
    }

    this.parsePayload(raw, channels)
  }

  parsePayload(raw, channels){
    if(!this.short){

      try{

        this.parsed.data = fromBinary(protobufs.Mesh.DataSchema, raw.slice(16))
        this.parsed.encrypted = false
        this.parsed.decoded = false
      } catch (err){
        //encrypted 

        this.parsed.encrypted = true
        this.parsed.decrypted = false
        this.parsed.decoded = false
      }

    
 

      if(this.parsed.encrypted){
        let key = null
        let data = tryDecryptChannelPacket(raw, channels.DEFCONnect); key ='DEFCONnect'
        if(!data){ data = tryDecryptChannelPacket(raw, channels.HackerComms); key='HackerComms'}
        if(!data){ data = tryDecryptChannelPacket(raw, channels.NodeChat); key='NodeChat' }
        if(!data){ data = tryDecryptChannelPacket(raw, channels.Default); key='Default' }
        if(!data){ data = tryDecryptChannelPacket(raw, channels.Default2); key='Default2' }
      
        this.parsed.data = data
        this.parsed.decrypted = true

        if(data){ this.parsed.channel = key }

      }

    }


    if(this.parsed.data && this.parsed.data.portnum != 0){

      let scheme = PortNumToProtoBuf[ this.parsed.data.portnum ]

      if(scheme != null && scheme != undefined){

        this.parsed.content = fromBinary(scheme, this.parsed.data.payload)
        delete this.parsed.data.payload
        this.parsed.decoded = true
      } else if(this.parsed.data.portnum == 1) {
        this.parsed.content = this.parsed.data.payload
        delete this.parsed.data.payload
        this.parsed.decoded = true
      }
    }
  }


  async genKey(){
    //if(this.marauderKey != null){ return }


    let seed = await hkdf('sha512', this.parsed.macaddr, new Uint8Array(32), '', 32)

    const theKey = ed25519.keygen(seed)
    console.log(theKey)
    return theKey
  }


  toObject(){
    return {
      meta:this.meta,
      header: this.header,
      parsed: this.parsed,
      short: this.short
    }
  }

}