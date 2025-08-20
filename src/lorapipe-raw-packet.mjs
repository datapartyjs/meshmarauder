
import { randomBytes } from '@noble/ciphers/webcrypto.js'
import {fromBinary, toBinary} from '@bufbuild/protobuf'
import * as protobufs from '@meshtastic/protobufs'
import { UINT32_MAX } from '@bufbuild/protobuf/wire'

import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import hkdf from '@panva/hkdf'


import {
  tryDecryptChannelPacket, encryptChannelPacket,
  tryDecryptDM,
  PortNumToProtoBuf, CHANNELS,
  OUTBOUND_CHANNELS,
  uint32ToUint8Array
} from './utils.mjs'

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

    this.marauderKey = null

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

        //console.log('catch')

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
      
        
        if(data){ 
          this.parsed.channel = key
          this.parsed.decrypted = true
          this.parsed.data = data
        } else {
          this.raw = raw
        }

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

        //console.log(this.parsed.data)
        console.log(new Date(this.meta.seen), this.header.from, this.parsed.channel, '-', new TextDecoder().decode(this.parsed.content))

        delete this.parsed.data.payload
        this.parsed.decoded = true
      }
    }
  }

  async channelChat(key, text){
    let rawPayload = toBinary(protobufs.Mesh.DataSchema,
      {  '$typeName': 'meshtastic.Data',
        portnum: 1,
        payload: new TextEncoder().encode(text),
        wantResponse: false,
        //dest: 0,
        //source: 0,
        //requestId: 0,
        //replyId: 0,
        //emoji: 0,
        //bitfield: 0
      }
    )

      

    let ppacketId = randomBytes(4)
    const ppacketIdView = new DataView(ppacketId.buffer)

    let encPayload = encryptChannelPacket(
      OUTBOUND_CHANNELS[key] ? OUTBOUND_CHANNELS[key] : OUTBOUND_CHANNELS.DEFCONnect,
      rawPayload,
      uint32ToUint8Array(this.header.from),
      ppacketId
    )

    let forgedPkt = new DataView( new ArrayBuffer(encPayload.byteLength + 16) )

    for(let i=0; i<encPayload.byteLength; i++){
      let val = encPayload.at(i)
      forgedPkt.setUint8(i+16, val)
    }

    forgedPkt.setUint32(0, UINT32_MAX)

    let flags = (
      (0xff & 0x7) |
      (this.header.flagsByte & 0x8) |
      (this.header.flagsByte & 0x10) |  // mqtt
      (0xff  & 0xE0)
    )

    
    forgedPkt.setUint32(4, this.header.from)
    forgedPkt.setUint32(8, ppacketIdView.getUint32(0))
    forgedPkt.setUint8(12, flags)
    forgedPkt.setUint8(13, this.header.channel)
    forgedPkt.setUint8(14, this.header.next_hop)
    forgedPkt.setUint8(15, this.header.relay_node)


    return forgedPkt.buffer
  }

  async decryptDM(messagePkt, fromUser){
    await this.genKey()

    console.log(messagePkt)

    await tryDecryptDM(messagePkt, this, fromUser)
    
  }

  /**
   * 
   * 
   * 
   * @param {Uint8Array} toAddr 
   * @param {Uint8Array} toPubKey 
   * @param {string|Uint8Array} text 
   */
  async sendDM(toAddr, toPubKey, text){
    await this.genKey()
    
    //
  }

  async genKey(){
    if(this.marauderKey != null){ return this.marauderKey }


    let seed = await hkdf('sha512', this.parsed.content.macaddr, new Uint8Array(32), 'meshmarauder', 32)

    
    //const theKey = ed25519.keygen(seed)
    const theKey = x25519.keygen(seed)
    this.marauderKey = theKey
    //console.log(theKey)
    return theKey
  }

  async genPoison(){
    let { publicKey } = await this.genKey()
    this.parsed.content.publicKey = publicKey

    if(this.parsed.content.longName.indexOf('🥷') == -1){
      this.parsed.content.longName = this.parsed.content.longName + '🥷'
    }

    let scheme = PortNumToProtoBuf[ this.parsed.data.portnum ]

    if(scheme != null && !this.short && this.parsed.decoded == true){

      this.parsed.data.payload = toBinary( protobufs.Mesh.UserSchema, this.parsed.content  )

      let rawPayload = toBinary(protobufs.Mesh.DataSchema, this.parsed.data)

      let ppacketId = randomBytes(4)
      const ppacketIdView = new DataView(ppacketId.buffer)

      let encPayload = encryptChannelPacket(
        OUTBOUND_CHANNELS[this.parsed.channel] || OUTBOUND_CHANNELS.DEFCONnect,
        rawPayload,
        uint32ToUint8Array(this.header.from),
        ppacketId
      )

      let poisonPkt = new DataView( new ArrayBuffer(encPayload.byteLength + 16) )

      for(let i=0; i<encPayload.byteLength; i++){
        let val = encPayload.at(i)
        poisonPkt.setUint8(i+16, val)
      }

      //if(this.parsed.is_broadcast){
        //poisonPkt.setUint32(0, UINT32_MAX)
      //} else {
        poisonPkt.setUint32(0, this.header.to)
      //}

/*
      hop_limit: this.header.flagsByte & 0x7,
      want_ack: (this.header.flagsByte & 0x8) >> 3,
      via_mqtt: (this.header.flagsByte & 0x10) >> 4,
      hop_start:(this.header.flagsByte & 0xE0) >> 5 */

      let flags = (
        (0xff & 0x7) |                    // hop_limit
        (this.header.flagsByte & 0x8) |   // want_ack
        (this.header.flagsByte & 0x10) |  // via_mqtt
        (0xff  & 0xE0)                    // hop_start
      )

      
      poisonPkt.setUint32(4, this.header.from)
      poisonPkt.setUint32(8, ppacketIdView.getUint32(0))
      poisonPkt.setUint8(12, flags)
      poisonPkt.setUint8(13, this.header.channel)
      poisonPkt.setUint8(14, this.header.next_hop)
      poisonPkt.setUint8(15, this.header.relay_node)


      return poisonPkt.buffer

    }

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