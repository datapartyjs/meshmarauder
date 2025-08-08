export class LorapipeRawPacket {

  /**
   * 
   * @param {Number} timestamp 
   * @param {Number} rssi 
   * @param {Number} snr 
   * @param {Uint8Array} raw 
   */
  constructor(timestamp, rssi, snr, raw, channels){
    this.meta = { timestamp, rssi, snr }

    this.header = { }

    this.parsed = {}

    if(raw.length == 0) {throw new Error('packet empty') }


    this.short = false
    let view = new DataView(raw.buffer)


    if(raw.length >= 4){ header.to = view.getUint32(0) } else {this.short=true}
    if(raw.length >= 8) { header.from = view.getUint32(4) } else {this.short=true}
    if(raw.length >= 12) { header.id = view.getUint32(8) } else {this.short=true}
    if(raw.length >= 13) { 
      header.flagsByte = view.getUint8(12)
      header.flags = {
        hop_limit: header.flagsByte & 0x7,
        want_ack: (header.flagsByte & 0x8) >> 3,
        via_mqtt: (header.flagsByte & 0x10) >> 4,
        hop_start:(header.flagsByte & 0xE0) >> 5

      }
    } else {this.short=true}
    if(raw.length >= 14) { header.channel = view.getUint8(13) } else {this.short=true}
    if(raw.length >= 15) { header.next_hop = view.getUint8(14) } else {this.short=true}
    if(raw.length >= 16) { header.relay_node = view.getUint8(15) } else {this.short=true}

    

    if(header.to != UINT32_MAX){
      this.parsed.is_dm = true
    } else {
      this.parsed.is_broadcast = true
    }

    this.parsePayload()
  }

  parsePayload(raw, channels){
    if(!this.short){

      try{

        this.parsed.data = fromBinary(protobufs.Mesh.DataSchema, raw.slice(16))
        this.parsed.encrypted = false
        this.parsed.decoded = false
        not_enc_count++

        //process.exit()
      } catch (err){
        //encrypted 

        this.parsed.encrypted = true
        this.parsed.decrypted = false
        this.parsed.decoded = false
        enc_count++
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

}