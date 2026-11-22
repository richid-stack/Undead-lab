/**
 * oni.js
 * Original Oni Night gear builders (mask, horns, hats, lantern).
 */
import * as THREE from 'three';
import { glow, M } from '../../core/engine.js';
// ---------- original gear builders (verbatim from Oni Night) ----------
export function maskTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,0,512);bg.addColorStop(0,'#f3ede0');bg.addColorStop(1,'#d8cdb8');g.fillStyle=bg;g.fillRect(0,0,512,512);
  g.fillStyle='rgba(120,90,60,.12)';for(let i=0;i<500;i++)g.fillRect(Math.random()*512,Math.random()*512,Math.random()*3,Math.random()*3);
  g.fillStyle='#b3161f';
  for(const s of[0,1]){const f=s?-1:1,cx=s?512:0;for(let i=0;i<3;i++){g.beginPath();g.moveTo(cx+f*40,230+i*34);g.quadraticCurveTo(cx+f*130,250+i*30,cx+f*190,330+i*26);g.lineTo(cx+f*182,344+i*26);g.quadraticCurveTo(cx+f*120,274+i*30,cx+f*40,246+i*34);g.fill()}}
  g.fillStyle='#240f12';g.beginPath();g.moveTo(40,150);g.quadraticCurveTo(256,95,472,150);g.lineTo(460,190);g.quadraticCurveTo(256,150,52,190);g.fill();
  for(const x of[150,362]){g.fillStyle='#120608';g.beginPath();g.ellipse(x,236,62,40,x<256?.35:-.35,0,7);g.fill();g.strokeStyle='#d9a33a';g.lineWidth=7;g.stroke()}
  g.fillStyle='#8a1017';g.beginPath();g.moveTo(256,225);g.lineTo(285,330);g.lineTo(256,345);g.lineTo(227,330);g.fill();
  g.fillStyle='#16080a';g.beginPath();g.moveTo(130,400);g.quadraticCurveTo(256,470,382,400);g.quadraticCurveTo(256,520,130,400);g.fill();
  g.fillStyle='#f6f0e2';for(let i=0;i<9;i++){const x=160+i*24;g.beginPath();g.moveTo(x,424+Math.sin(i/8*3.14)*18);g.lineTo(x+10,424+Math.sin(i/8*3.14)*18);g.lineTo(x+5,448+Math.sin(i/8*3.14)*22);g.fill()}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export function horn(side,len=.2){
  const g=new THREE.Group(),pts=[new THREE.Vector3(side*.05,.2,.07),new THREE.Vector3(side*.085,.25,.095),new THREE.Vector3(side*.09,.3,.12),new THREE.Vector3(side*.07,.35,.15)];
  const cv=new THREE.CatmullRomCurve3(pts),N=12,up=new THREE.Vector3(0,1,0);
  for(let i=0;i<N;i++){const a=cv.getPoint(i/N),b=cv.getPoint((i+1)/N),d=b.clone().sub(a),r0=.021*(1-i/N)+.002,r1=.021*(1-(i+1)/N)+.002;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,d.length()*1.05,10),M(i<N-3?0xe9dfc9:0x8a1a1a,{roughness:.4}));
    m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,d.normalize());m.castShadow=true;g.add(m)}
  return g;
}
export function oniGear(){
  const g=new THREE.Group();
  const mane=new THREE.Mesh(new THREE.SphereGeometry(.118,28,20),M(0x1a1013,{roughness:.9}));mane.position.set(0,.11,-.035);mane.scale.set(1,1.08,1);mane.castShadow=true;g.add(mane);
  const hairM=M(0x1a1013,{roughness:.8}),tipM=M(0x8a1a1a,{roughness:.6});
  for(let i=0;i<46;i++){const u=Math.random(),v=Math.random(),th=Math.acos(1-v*1.1),ph=(u*1.7+0.65)*Math.PI;const d=new THREE.Vector3(Math.sin(th)*Math.cos(ph),Math.cos(th)*.8+.2,Math.sin(th)*Math.sin(ph)-.3).normalize();
    const L=.12+Math.random()*.12,c=new THREE.Mesh(new THREE.ConeGeometry(.012,L,6),i%5?hairM:tipM);c.position.set(0,.11,-.035).addScaledVector(d,.1+L/2);c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);c.castShadow=true;g.add(c)}
  const plate=new THREE.Mesh(new THREE.SphereGeometry(.108,40,28,Math.PI/2-.95,1.9,Math.PI/2-.95,1.9),M(0xffffff,{map:maskTexture(),roughness:.38,metalness:.02}));
  plate.scale.set(1,1.12,.66);plate.position.set(0,.105,.03);plate.castShadow=true;g.add(plate);
  const eyeM=new THREE.MeshBasicMaterial({color:0xffc83a});
  for(const s of[-1,1]){const e=new THREE.Mesh(new THREE.CircleGeometry(.0085,16),eyeM);e.position.set(s*.036,.116,.1);e.rotation.y=s*.2;g.add(e);const gl=glow(0xffb020,.07);gl.position.set(s*.036,.116,.106);g.add(gl)}
  g.add(horn(1),horn(-1));
  for(const s of[-1,1]){const f=new THREE.Mesh(new THREE.ConeGeometry(.005,.026,8),M(0xf6f0e2,{roughness:.3}));f.position.set(s*.026,.06,.095);f.rotation.x=Math.PI;g.add(f)}
  return g;
}
export function guardGear(){
  const g=new THREE.Group();
  const band=new THREE.Mesh(new THREE.TorusGeometry(.098,.009,10,40),M(0xb3161f,{roughness:.7}));band.rotation.x=Math.PI/2;band.position.set(0,.15,-.005);band.scale.set(1,1.1,1);g.add(band);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.06,.028,.006),M(0xc9a24a,{metalness:.8,roughness:.3}));plate.position.set(0,.15,.1);g.add(plate);
  for(const s of[-1,1]){const t=new THREE.Mesh(new THREE.BoxGeometry(.018,.17,.004),M(0xb3161f,{roughness:.7}));t.position.set(s*.02,.08,-.115);t.rotation.set(.25,0,s*.15);g.add(t)}
  const sc=new THREE.Mesh(new THREE.TorusGeometry(.09,.032,12,36),M(0xb3161f,{roughness:.85}));sc.rotation.x=Math.PI/2;sc.position.set(0,-.01,.01);g.add(sc);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(.075,.34,.012),M(0xb3161f,{roughness:.85}));tail.position.set(.05,-.17,-.09);tail.rotation.z=.12;g.add(tail);
  return g;
}
export function keeperGear(){
  const g=new THREE.Group();
  const hat=new THREE.Mesh(new THREE.ConeGeometry(.26,.12,40,1,true),M(0xcaa86a,{roughness:.9,side:2}));hat.position.set(0,.2,.02);g.add(hat);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.018,12,10),M(0x6a4a2a));knob.position.set(0,.265,.02);g.add(knob);
  return g;
}
export function lantern(color=0xff8a3a){
  const g=new THREE.Group(),c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');x.fillStyle='#ffcf8a';x.fillRect(0,0,64,128);x.strokeStyle='#8a3a10';x.lineWidth=3;for(let i=1;i<8;i++){x.beginPath();x.moveTo(0,i*16);x.lineTo(64,i*16);x.stroke()}
  const t=new THREE.CanvasTexture(c);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.16,20,1,true),new THREE.MeshStandardMaterial({map:t,emissive:color,emissiveMap:t,emissiveIntensity:1.5,side:2}));g.add(body);
  for(const y of[-.085,.085]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.015,20),M(0x2a1a10));cap.position.y=y;g.add(cap)}
  g.add(glow(color,.5));const l=new THREE.PointLight(color,.9,5,2);g.add(l);
  const cord=new THREE.Mesh(new THREE.CylinderGeometry(.002,.002,.2),M(0x222222));cord.position.y=.2;g.add(cord);return g;
}
