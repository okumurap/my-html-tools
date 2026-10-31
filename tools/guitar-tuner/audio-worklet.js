// Keep the rendering thread cheap: only capture and transfer PCM blocks.
class Capture extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Float32Array(1024);this.pos=0;}
 process(inputs){const input=inputs[0]?.[0];if(input)for(const v of input){this.buffer[this.pos++]=v;if(this.pos===this.buffer.length){this.port.postMessage(this.buffer,[this.buffer.buffer]);this.buffer=new Float32Array(1024);this.pos=0;}}return true;}
}
registerProcessor('tuner-capture',Capture);
