import * as fs from 'fs'
import * as readline from 'readline'
import {fromBinary, toBinary} from '@bufbuild/protobuf'
import * as protobufs from '@meshtastic/protobufs'


import {tryDecryptPacket} from './utils.mjs'
import { UINT32_MAX } from '@bufbuild/protobuf/wire'

const PortNumToProtoBuf = {
  0: null, //binary - unknown packet format
  1: null, // utf-8 - chat message
  2: protobufs.Mesh.NodeRemoteHardwarePinSchema,
  3: protobufs.Mesh.PositionSchema,
  4: protobufs.Mesh.UserSchema,
  5: protobufs.Mesh.RoutingSchema,
  6: protobufs.Admin.AdminMessageSchema,
  7: null, //Unishox2 Compressed utf-8
  8: protobufs.Mesh.WaypointSchema,
  9: null, //codec2 packets
  10: null,
  12: protobufs.Mesh.KeyVerificationSchema,
        // 'ping' - replies to all packets.
	// type - char[]
  32: null, 
        // send and receive telemetry data
	// type - Protobuf
  67: null, //Telemetry
  70: null, //traceroute
  73: null  //Map report
}

// https://meshtastic.org/docs/overview/encryption

let enc_count = 0
let not_enc_count = 0
let dec_count = 0
let dec_fail_count = 0
let dm_count = 0
let mqtt = 0
let not_mqtt = 0

let packet_types = {}
let users = {}

function base64ToArrayBuffer(base64) {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Uint8Array(bytes.buffer);
}


const channels = {
  Default: new Uint8Array(32),
  DEFCONnect: base64ToArrayBuffer('OEu8wB3AItGBvza4YSHh+5a3LlW/dCJ+nWr7SNZMsaE='),
  HackerComms: base64ToArrayBuffer('6IzsaoVhx1ETWeWuu0dUWMLqItvYJLbRzwgTAKCfvtY='),
  NodeChat: base64ToArrayBuffer('TiIdi8MJG+IRnIkS8iUZXRU+MHuGtuzEasOWXp4QndU=')
}

channels.Default[31] = 1

console.log(channels)

//process.exit()


async function main() {
  const fileName = process.argv[2];


  const fileStream = fs.createReadStream(fileName)

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  // crlfDelay option to clean up CR LF to a one line break

  for await (const line of rl) {
    //console.log(`Line from file: ${line}`);

    let lineCleaned = line.trim().replace('RAW: ', '')
    const pkt = Uint8Array.from(Buffer.from(lineCleaned, 'hex'))

    if(pkt.length == 0) {
      continue;
    }


    let short = false
    let parsedPacket = {}
    let view = new DataView(pkt.buffer)


    if(pkt.length >= 4){ parsedPacket.addrTo = view.getUint32(0) } else {short=true}
    if(pkt.length >= 8) { parsedPacket.addrFrom = view.getUint32(4) } else {short=true}
    if(pkt.length >= 12) { parsedPacket.pktId = view.getUint32(8) } else {short=true}
    if(pkt.length >= 13) { 
      parsedPacket.flagsByte = view.getUint8(12)
      parsedPacket.flags = {
        hop_limit: parsedPacket.flagsByte & 0x7,
        want_ack: (parsedPacket.flagsByte & 0x8) >> 3,
        via_mqtt: (parsedPacket.flagsByte & 0x10) >> 4,
        hop_start:(parsedPacket.flagsByte & 0xE0) >> 5
  
      }

      if(parsedPacket.flags.via_mqtt){
        mqtt++
      } else { not_mqtt++ }
    } else {short=true}
    if(pkt.length >= 14) { parsedPacket.channel = view.getUint8(13) } else {short=true}
    if(pkt.length >= 15) { parsedPacket.next_hop = view.getUint8(14) } else {short=true}
    if(pkt.length >= 16) { parsedPacket.relay_node = view.getUint8(15) } else {short=true}

    

    if(parsedPacket.addrTo != UINT32_MAX){
      dm_count++
    }

    if(!short){

      try{

        parsedPacket.payload = fromBinary(protobufs.Mesh.DataSchema, pkt.slice(16))
        parsedPacket.encrypted = false
        not_enc_count++

        //process.exit()
      } catch (err){
        //encrypted

        /* PKI decrypt, loops over user keys

         if (crypto->decryptCurve25519(
         p->from,
         nodeDB->getMeshNode(p->from)->user.public_key,
         p->id,
         rawSize,
         p->encrypted.bytes,
         bytes)) {*/

        //         

        parsedPacket.encrypted = true
        enc_count++
      }

    
 

      if(!parsedPacket.encrypted){



      } else {

      let key = null
      let payload = tryDecryptPacket(pkt, channels.DEFCONnect); key ='DEFCONnect'
      if(!payload){ payload = tryDecryptPacket(pkt, channels.HackerComms); key='HackerComms'}
      if(!payload){ payload = tryDecryptPacket(pkt, channels.NodeChat); key='NodeChat' }
      if(!payload){ payload = tryDecryptPacket(pkt, channels.Default); key='Default' }
    
      parsedPacket.payload = payload

      if(payload){
        dec_count++
        parsedPacket.channel = key
        //console.log(parsedPacket)
      } else {
        dec_fail_count++
      }

      }

    }
    //console.log(parsedPacket)

    if(parsedPacket.payload){
      let port = parsedPacket.payload.portnum
      if(packet_types[port]){
        packet_types[port]++
      } else {
        packet_types[port] = 1
      }
    }

    if(parsedPacket.payload && parsedPacket.payload.portnum != 0){

      let scheme = PortNumToProtoBuf[ parsedPacket.payload.portnum ]

      if(scheme != null && scheme != undefined){

        parsedPacket.data = fromBinary(scheme, parsedPacket.payload.payload)
        delete parsedPacket.payload.payload

        if( parsedPacket.data['$typeName'] == 'meshtastic.User' && parsedPacket.data.publicKey.length > 0){


	  if( !users[ parsedPacket.data['id'] ]){
	  users[ parsedPacket.data['id'] ] = parsedPacket.data['longName']

          console.log(parsedPacket.data['longName'])
          }
        }

      }
    }

    

  }

  let stats = {
    mqtt, not_mqtt, enc_count, not_enc_count, dec_count, dec_fail_count, dm_count, user_count: Object.keys(users).length
  }

  console.log(packet_types)
  console.log(stats)
}


main();



