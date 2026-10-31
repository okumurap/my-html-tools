import {Sampler} from './pitch-detector.js';
let sampler;
onmessage=({data})=>{if(data.rate)sampler=new Sampler(data.rate,result=>postMessage(result));else if(sampler)sampler.push(data);};
