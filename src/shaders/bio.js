/**
 * bio.js
 * BIO shader: procedural skin / rot / wound / blood / grime / armour-wear layers injected into any three.js material.
 */
import * as THREE from 'three';
import { clamp, cvs, QL, floor, P } from '../core/engine.js';

// =====================================================================================
//  BIO shader: procedural skin / rot / wound / blood / grime layers injected into any
//  MeshStandard/Physical material. Noise is anchored in rest-pose space so it follows
//  skinned animation. Heights are in metres and turned into a derivative-based bump.
// =====================================================================================
export const BIO_T = { value: 0 }, BIO_Q = { value: QL === 'low' ? 0 : 1 };
export const WHITE1 = (() => { const [c, g] = cvs(2, 2); g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); return new THREE.CanvasTexture(c) })();

export const BIO_DECL = /* glsl */`
varying vec3 vRest;
uniform vec4 uRecA,uRecB; uniform float uRec,uCirc;
uniform float uSkin,uHuman,uZ,uGrime,uBlood,uSeed,uPores,uSSS,uGlow,uBump,uWear,uT,uQ,uEyeHole,uRotAmt,uMetalSkin;
uniform vec3 uGlowCol,uBloodCol,uTintMul;
uniform int uWn; uniform vec4 uW[8]; uniform float uWt[8];
uniform sampler2D uSkinMask; uniform float uUseMask;
uniform vec2 uEyes[2]; uniform vec2 uEyeR;
float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
vec3 h33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.07+vec3(1.7,9.2,3.1);a*=.5;}return s;}
float ridge(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*(1.-abs(vn(p)*2.-1.));p=p*2.1+vec3(5.3,1.1,7.7);a*=.5;}return s;}
vec2 worley(vec3 p){vec3 i=floor(p),f=fract(p);float d1=9.,d2=9.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(float(x),float(y),float(z));float d=length(g+h33(i+g)-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return vec2(d1,d2);}
`;

export const BIO_MAIN = /* glsl */`
float bioH=0.; vec3 bioE=vec3(0.); float bioWet=0.; float bioR=.5; float bioSk=0.; float bioDry=0.; float bioMetal=-1.;
#ifdef USE_MAP
if(uEyeHole>.5){ for(int i=0;i<2;i++){ vec2 e=(vMapUv-uEyes[i])/uEyeR; if(dot(e,e)<1.) discard; } }
#endif
{
  vec3 P=vRest; vec3 base=diffuseColor.rgb; float L=dot(base,vec3(.2126,.7152,.0722));
  float sk=uSkin;
  #ifdef USE_MAP
  sk*=mix(1.,texture2D(uSkinMask,vMapUv).r,uUseMask);
  #endif
  bioSk=sk;
  vec3 col=base;
  float pw=length(fwidth(P));                              // metres per pixel
  float poreFade=1.-smoothstep(.0005,.0016,pw);

  // ---------- living skin richness ----------
  if(uHuman>0.){
    float flush=smoothstep(.45,.8,fbm3(P*20.+uSeed))*.16;
    col=mix(col,col*vec3(1.13,.83,.78),flush*uHuman*sk);
    float fr=smoothstep(.74,.8,vn(P*340.+uSeed));
    col=mix(col,col*vec3(.78,.6,.5),fr*.3*uHuman*sk);
    float mic=vn(P*650.+uSeed)*.6+vn(P*1500.)*.4;
    col*=1.+(mic-.5)*.10*uHuman*sk*poreFade;
  }
  // pores / micro relief on any skin
  bioH+=((vn(P*620.+uSeed)-.5)*.00022+(vn(P*1400.)-.5)*.00010)*uPores*sk*poreFade;

  // ---------- rot / undeath ----------
  float z=uZ*sk;
  if(z>0.){
    float blot=fbm(P*5.+uSeed*3.), blot2=fbm(P*17.+uSeed);
    vec3 dead=mix(vec3(L),col,.32)*vec3(.82,.95,.9)*.78;
    dead=mix(dead,vec3(.36,.40,.37)*(.5+.9*blot2),.5);
    vec3 bruise=mix(vec3(.24,.11,.24),vec3(.21,.31,.11),smoothstep(.4,.72,blot2));
    dead=mix(dead,bruise*(.5+L*1.4),smoothstep(.5,.8,blot)*.85*uRotAmt);
    float vr=ridge(P*10.+uSeed), vt=ridge(P*27.+uSeed*2.);
    float vm=(smoothstep(.80,.93,vr)*.9+smoothstep(.86,.95,vt)*.55)*smoothstep(.33,.66,fbm3(P*3.+7.));
    vm=clamp(vm,0.,1.);
    dead=mix(dead,vec3(.06,.045,.12),vm*.85);
    bioE+=uGlowCol*vm*uGlow*z*(.65+.35*sin(uT*2.1+P.y*9.));
    bioH+=vm*.00035;
    if(uQ>.5){
      vec2 w2=worley(P*36.+uSeed); float cr=1.-smoothstep(.0,.075,w2.y-w2.x); cr*=smoothstep(.45,.72,blot)*uRotAmt;
      dead*=1.-cr*.42; bioH-=cr*.0011;
    }
    float flake=smoothstep(.62,.74,fbm(P*60.+uSeed));
    dead=mix(dead,dead*1.35+.03,flake*.35);
    col=mix(col,dead,z); bioDry=z*.9;
    #ifdef USE_MAP
    if(uEyeHole>.5){ float er=min(length((vMapUv-uEyes[0])/uEyeR),length((vMapUv-uEyes[1])/uEyeR)); float sock=1.-smoothstep(1.,3.4,er); col=mix(col,vec3(.045,.02,.05),sock*.8*z); }
    #endif
  }

  // ---------- hero recolour (luminance-driven two-tone) + energy circuitry ----------
  if(uRec>0.){ float k=smoothstep(.08,.45,L); vec3 rc=mix(uRecB.rgb,uRecA.rgb,k)*(.55+1.1*L); col=mix(col,rc,uRec); }
  if(uCirc>0.){ float cr=ridge(P*7.+uSeed); float ln=smoothstep(.905,.96,cr)*smoothstep(.38,.62,fbm3(P*2.2+3.)); bioE+=uGlowCol*ln*uCirc*(.75+.25*sin(uT*3.+P.y*8.)); }

  // ---------- grime / dirt (all materials) ----------
  float dirt=fbm(P*11.+uSeed*7.)*.6+fbm3(P*38.)*.4;
  float lowBias=smoothstep(1.3,.0,P.y)*.55+.45;
  float dm=smoothstep(.34,.86,dirt)*uGrime*lowBias;
  col=mix(col,col*vec3(.36,.30,.24)+vec3(.012,.008,.004),dm*.78);
  bioH+=dm*.0004*fbm3(P*90.);

  // ---------- armour wear (scratches / chipped paint) ----------
  if(uWear>0.){
    float sc=vn(vec3(P.x*420.,P.y*9.,P.z*420.))*vn(vec3(P.x*9.,P.y*380.,P.z*380.));
    float sc2=vn(vec3(P.x*7.,P.y*300.,P.z*300.)+4.);
    float scr=smoothstep(.34,.5,sc)+smoothstep(.62,.7,sc2)*.6;
    float chip=smoothstep(.62,.78,fbm(P*26.+uSeed))*smoothstep(.45,.6,fbm3(P*5.));
    col=mix(col,col*1.45+.04,clamp(scr,0.,1.)*.22*uWear);
    col=mix(col,vec3(.46,.46,.5)*(.75+.5*vn(P*140.)),chip*.55*uWear); bioMetal=chip*uWear;
    bioH+=-chip*.00045*uWear+scr*.00008*uWear;
  }

  // ---------- wounds ----------
  float woundBlood=0.;
  for(int i=0;i<8;i++){ if(i>=uWn) break;
    vec4 w=uW[i]; float d=length(P-w.xyz)/w.w;
    d+=(fbm(P*52.+float(i)*3.)-.5)*.55;
    float inner=1.-smoothstep(.52,.8,d), rimM=1.-smoothstep(.78,1.55,d);
    vec3 flesh=mix(vec3(.34,.03,.035),vec3(.085,.008,.012),fbm(P*85.));
    float fib=vn(vec3(P.x*160.,P.y*20.,P.z*160.)); flesh*=.72+.55*fib;
    if(uWt[i]>.5){ vec3 bone=vec3(.64,.58,.44)*(.62+.38*vn(P*180.)); flesh=mix(flesh,bone,smoothstep(.46,.0,d)); }
    col=mix(col,mix(col,vec3(.13,.045,.08),.8),rimM*(1.-inner));
    col=mix(col,flesh,inner);
    bioH+=rimM*(1.-inner)*.0016-inner*(.0045+.002*fbm(P*130.));
    bioWet=max(bioWet,inner*.85); bioR=.2;
    float dy=w.y-P.y;
    if(dy>0.){
      float lane=exp(-pow(length(P.xz-w.xz)/(w.w*.85+.010*(1.+4.*vn(vec3(P.x*70.,0.,P.z*70.)))),2.));
      float run=exp(-dy/(w.w*8.+.22));
      float stripe=smoothstep(.28,.66,vn(vec3(P.x*100.,P.y*4.,P.z*100.)));
      woundBlood=max(woundBlood,lane*run*stripe);
    }
  }

  // ---------- blood: splatter, drips, wound runoff ----------
  float spl=smoothstep(.64,.72,fbm(P*7.+uSeed*5.))*uBlood;
  float stk=vn(vec3(P.x*58.,P.y*2.6,P.z*58.));
  float drp=smoothstep(.70,.80,stk)*smoothstep(.5,.78,fbm3(P*2.6+4.))*uBlood;
  float fleck=smoothstep(.80,.84,vn(P*150.+uSeed))*uBlood*.18;
  float bm=clamp(max(max(spl,drp),max(fleck,woundBlood*1.1)),0.,1.);
  float fresh=smoothstep(.3,.8,fbm3(P*9.+uSeed));
  vec3 bcol=mix(vec3(.045,.006,.007),vec3(.33,.014,.016),fresh)*uBloodCol;
  col=mix(col,bcol,bm*.93);
  bioH+=bm*.0004; bioWet=max(bioWet,bm*(.35+.55*fresh)); bioR=mix(bioR,.14,bm*fresh);

  col*=uTintMul;
  diffuseColor.rgb=col;
}
`;

export const BIO_ROUGH = /* glsl */`
roughnessFactor=mix(roughnessFactor,max(roughnessFactor,.8),bioDry);
roughnessFactor=mix(roughnessFactor,bioR,bioWet);
#ifdef USE_METALNESSMAP
#endif
`;
export const BIO_NORMAL = /* glsl */`
{
  vec3 sp=-vViewPosition; vec3 sx=dFdx(sp), sy=dFdy(sp);
  vec3 r1=cross(sy,normal), r2=cross(normal,sx); float det=dot(sx,r1);
  vec3 grad=sign(det)*(dFdx(bioH)*uBump*r1+dFdy(bioH)*uBump*r2);
  normal=normalize(abs(det)*normal-grad);
}
`;

export function injectBio(mat, o = {}) {
  const U = {
    uOrigin: { value: o.origin || new THREE.Vector3() }, uScale: { value: o.scale ?? 1 },
    uSkin: { value: o.skin ?? 0 }, uHuman: { value: o.human ?? 0 }, uZ: { value: o.zombie ?? 0 }, uRotAmt: { value: o.rot ?? 1 },
    uGrime: { value: o.grime ?? 0 }, uBlood: { value: o.blood ?? 0 }, uSeed: { value: o.seed ?? 1 }, uPores: { value: o.pores ?? 1 },
    uSSS: { value: o.sss ?? 0 }, uGlow: { value: o.glow ?? 0 }, uGlowCol: { value: new THREE.Color(o.glowCol ?? 0x40ff90) },
    uBump: { value: o.bump ?? 1 }, uWear: { value: o.wear ?? 0 }, uBloodCol: { value: new THREE.Color(o.bloodCol ?? 0xffffff) }, uTintMul: { value: new THREE.Color(o.tint ?? 0xffffff) },
    uWn: { value: 0 }, uW: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uWt: { value: new Float32Array(8) },
    uSkinMask: { value: o.skinMask || WHITE1 }, uUseMask: { value: o.skinMask ? 1 : 0 },
    uEyes: { value: [new THREE.Vector2(), new THREE.Vector2()] }, uEyeR: { value: new THREE.Vector2(.04, .02) }, uEyeHole: { value: 0 },
    uT: BIO_T, uQ: BIO_Q, uMetalSkin: { value: 0 },
    uRec: { value: o.rec ?? 0 }, uRecA: { value: new THREE.Vector4(...(o.recA || [1, 1, 1, 1])) }, uRecB: { value: new THREE.Vector4(...(o.recB || [.1, .1, .1, 1])) }, uCirc: { value: o.circ ?? 0 },
  };
  (o.wounds || []).forEach((w, i) => { U.uW.value[i].set(w[0], w[1], w[2], w[3]); U.uWt.value[i] = w[4] || 0; U.uWn.value = i + 1 });
  mat.userData.bio = U;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;uniform vec3 uOrigin;uniform float uScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest=(position-uOrigin)*uScale;');
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + BIO_DECL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + BIO_MAIN)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + BIO_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BIO_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=bioE;');
    if (bioMetalHook) f = f.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif(bioMetal>=0.) metalnessFactor=mix(metalnessFactor,.95,clamp(bioMetal,0.,1.));');
    // wrapped, red-shifted diffuse for skin subsurface look
    f = f.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment
      .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `vec3 irrD=irradiance; if(uSSS>0.){ float nl=dot(geometryNormal,directLight.direction); vec3 w=vec3(.62,.30,.14)*uSSS; vec3 wn=clamp((vec3(nl)+w)/(1.+w),0.,1.); irrD=wn*wn*(3.-2.*wn)*directLight.color; }
         reflectedLight.directDiffuse += irrD * BRDF_Lambert( material.diffuseColor );`));
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'bio3';
  return U;
}
export const bioMetalHook = true;

// rest-pose origin / scale so that P is ~metres: origin = bbox bottom-centre, scale = heightM / bboxHeight
export function restFrame(geo, heightM) {
  geo.computeBoundingBox(); const b = geo.boundingBox;
  return { origin: new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2), scale: heightM / (b.max.y - b.min.y) };
}
