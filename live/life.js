// life.js — T11 living stage.
import * as THREE from "three";
import { standing, skyline } from "./ambient.js";

const{min,max,abs,sin,cos,tan,PI,hypot,floor,round}=Math,TAU=PI*2,V2=THREE.Vector2,V3=THREE.Vector3,V4=THREE.Vector4,B3=THREE.Box3,CL=THREE.Color,CARDS=new URL("cards/life/",document.baseURI);
const SPR="snail-out,snail-hidden,caterpillar,butterfly-1,butterfly-2,bee,dragonfly,beetle,lizard,fish,frog,cricket,cat,bird-flock".split(",");
const CELL=Object.fromEntries(SPR.map((n,i)=>[n,i]));CELL.ant=14;
const CROW={
  snail:"Snail|ຫອຍທາກ|หอยทาก|蜗牛|かたつむり|Curls into its shell!",caterpillar:"Caterpillar|ບົ້ງ|หนอนผีเสื้อ|毛毛虫|あおむし|Inches along.",
  butterfly:"Butterfly|ແມງກະເບື້ອ|ผีเสื้อ|蝴蝶|ちょうちょ|Settles near you.||i-wing",bee:"Bee|ເຜິ້ງ|ผึ้ง|蜜蜂|みつばち|Buzzes by.||i-wing",
  dragonfly:"Dragonfly|ແມງປໍ|แมลงปอ|蜻蜓|とんぼ|Hovers over water.|looks|i-wing",beetle:"Beetle|ແມງກວາງ|แมลงปีกแข็ง|甲虫|こがねむし|Scurries by.||i-wood",
  lizard:"Lizard|ກັບແກ້|จิ้งจก|壁虎|やもり|Darts up the wall!||steps-stone",fish:"Fish|ປາ|ปลา|锦鲤|さかな|Leaps with a splash!||splash-small",
  frog:"Frog|ກົບ|กบ|青蛙|かえる|Hops by the water!||plop",cricket:"Cricket|ຈິ່ງຫຼີດ|จิ้งหรีด|蟋蟀|こおろぎ|Found a cricket!|find|crickets",
  cat:"Cat|ແມວ|แมว|小猫|ねこ|Found a cat!|find|child-giggle",bird:"Songbird|ນົກ|นก|小鸟|ことり|Wheels across the sky!||bird-chirp",
  ant:"Ant|ມົດ|มด|蚂蚁|あり|Marches in a line.",firefly:"Firefly|ຫິ່ງຫ້ອຍ|หิ่งห้อย|萤火虫|ほたる|Gathers to you!||lantern-glow",
  tree:"Tree|ຕົ້ນໄມ້|ต้นไม้|大树|き|Leaves rustle down!",ptree:"Peach Tree|ຕົ້ນຄາຍ|ต้นท้อ|桃树|もものき|Petals flutter down!",
};
const sndOf=k=>CROW[k]?.split("|")[7]||"leaves-rustle";
const cardOf=k=>{const s=CROW[k]?.split("|");return s&&{word:{en:s[0],lo:s[1],th:s[2],zh:s[3],ja:s[4]},en:s[5],tag:s[6]||"does"};};
const mkRng=s=>{let a=s>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};};
const B=([x,y,z])=>[x,z,-y],cl=(v,a,b)=>max(a,min(b,v)),ev=(t,d)=>dispatchEvent(new CustomEvent(t,{detail:d}));

const UH="uniform float uT,uRT,uM,uH;\n#define F float\n#define S smoothstep\n#define M mix\n#define C(x) clamp(x,0.,1.)\n#define SN(x) (.5+.5*sin(x))\n#define L length\n#define V2 vec2\n#define V3 vec3\n#define V4 vec4\n#define P 3.14159\n#define T 6.28318\n#define Q position\n#define GP gl_Position\n#define FC gl_FragColor\n#define PV projectionMatrix*viewMatrix\n";
const NS="F h21(V2 p){p=fract(p*V2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\nF vn(V2 p){V2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return M(M(h21(i),h21(i+V2(1.,0.)),f.x),M(h21(i+V2(0.,1.)),h21(i+V2(1.,1.)),f.x),f.y);}\nF bf(V2 u,F e){return S(0.,e,u.x)*S(0.,e,1.-u.x)*S(0.,e,u.y)*S(0.,e,1.-u.y);}\n";
const TK="a*=1.-S(.70,.78,gl_FragCoord.y/uH);";
const HD=(b,r)=>`uniform V4 uHD[8];${b}for(int i=0;i<8;i++){V4 h=uHD[i];if(h.w<=0.)break;V3 ro=cameraPosition,rd=h.xyz-ro;F hl=L(rd);if(hl<.05)continue;rd/=hl;V3 ap=p-ro;F pr=dot(ap,rd);if(pr<.08||pr>hl+.24)continue;V3 pd=ap-rd*pr;${r}}\n`;
const AV=HD("V3 avH(V3 p){","F d=L(pd);if(d<h.w){V3 u=d>1e-4?pd/d:V3(0.,1.,0.);p+=V3(u.x,abs(u.y)+.35,u.z*.2)*(h.w-d)*1.15;}}return p;");
const AF=HD("F hdF(V3 p){F f=1.;","F w2=h.w*h.w;f*=S(w2*.36,w2*1.69,dot(pd,pd));}return f;");

let aTex=null,aProm=null;const ASP={ant:1.6};
function loadAtlas(){
  if(aTex)return Promise.resolve(aTex);if(aProm)return aProm;
  const cv=Object.assign(document.createElement("canvas"),{width:1024,height:1024}),g=cv.getContext("2d");
  g.save();g.translate(640,908);g.fillStyle="#2b1d14";g.strokeStyle="#1a100a";g.lineWidth=6;
  for(const[x,a,b]of[[-46,30,22],[-2,22,18],[36,20,17]])g.beginPath(),g.ellipse(x,0,a,b,0,0,TAU),g.fill();
  g.beginPath();for(const x of[-16,0,16])g.moveTo(x,12),g.lineTo(x+(x<0?-20:18),38),g.moveTo(x,-8),g.lineTo(x+(x<0?-16:14),-30);
  g.moveTo(48,-6);g.lineTo(78,-22);g.moveTo(50,2);g.lineTo(80,-2);g.stroke();g.restore();
  const t=aTex=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;
  return(aProm=Promise.all(SPR.map((n,i)=>new Promise(res=>{
    const m=new Image();m.crossOrigin="anonymous";
    m.onload=()=>{const w=m.width,h=m.height,s=min(240/w,240/h),c=(i%4)*256,r=(i>>2)*256;g.clearRect(c,r,256,256);g.drawImage(m,c+128-w*s/2,r+248-h*s,w*s,h*s);ASP[n]=w/h;res();};
    m.onerror=()=>(ASP[n]=1,res());m.src=new URL(`${n}.webp`,CARDS).href;
  }))).then(()=>(t.needsUpdate=true,t)));
}

const AT_VS=`${UH}uniform F uK;attribute V3 aP;attribute V4 aD,aR;varying V2 vU;varying V4 vR;varying V3 vW;varying F vA;
void main(){vU=uv;vR=aR;vA=1.;F t=uT;V3 p=aP,l=V3(0.);
if(uK<.5)l=V3(Q.x*aD.x,.0025,-Q.y*aD.y);
else if(uK<1.5){F k=aR.x;l=k<.5?V3(Q.x*aD.x*(1.+.22*(.5-Q.y)),Q.y*aD.y,(.5-Q.y)*aD.z):k<1.5?V3(Q.x*aD.x,.004,-Q.y*aD.y):V3(Q.x*aD.x,(Q.y+.5)*aD.y,.015);}
else if(uK<2.5)l=V3(Q.x*aD.x,(Q.y+.5)*aD.y,0.);
else if(uK<3.5){F k=aR.w,vs=aR.y,ef=1.;
if(k<.5){F sp=max(.2,aD.w-aD.z),x=aD.z+mod(aP.x-aD.z+t*aR.x,sp);p.x=x;p.y+=.004*sin(t*.5+vs*T);ef=S(0.,.12,(x-aD.z)/sp)*S(0.,.12,(aD.w-x)/sp);}
else if(k<1.5){p.x+=.04*sin(t*.45+vs*T);p.y+=.018*sin(t*.9+vs*P);}
else if(k>2.5){if(uM<.5){GP=V4(2.,2.,2.,1.);return;}F cy=mod(t+vs*9.,9.),u=C(cy/1.5);p.x+=(u-.5)*.65;p.y-=u*.16;ef=sin(u*P)*step(cy,1.5);}
l=V3(Q.x*aD.x,Q.y*aD.y,0.);if(k>.5&&k<1.5){F an=.18*sin(t*1.1),c=cos(an),s=sin(an);l.xy=mat2(c,-s,s,c)*l.xy;}vA=aR.z*ef;}
else{F t0=aR.x,lf=aR.y,R=aR.z,rp=aR.w,ag=rp>0.?mod(t+t0,rp):(uM<.5?-1.:uRT-t0);if(lf<=0.||ag<0.||ag>lf){GP=V4(2.,2.,2.,1.);return;}
F u=ag/lf,r=R*(.18+.82*(1.-(1.-u)*(1.-u)));l=V3(Q.x*r*2.,.0035,-Q.y*r*2.);vA=(1.-u*u)*S(0.,.1,u)*.65;}
vW=p+l;GP=PV*V4(vW,1.);GP.z-=1.8e-4*GP.w;}`;

const AT_FS=`${UH}uniform F uK,uFM;uniform V3 uL,uC,uFC,uCC,uCR;varying V2 vU;varying V4 vR;varying V3 vW;varying F vA;${NS}${AF}
void main(){F t=uT,a=0.,lm=C(dot(uL,V3(.3,.59,.11)));V3 c=uC,wh=V3(.95,.98,1.)*uL;V2 q=vU*2.-1.;
if(uK<.5){V2 fl=vR.xy,p=vW.xz*24.-fl*t*14.;F n1=vn(p),n2=vn(mat2(.8,.6,-.6,.8)*p*2.1+V2(t*.7,-t*.5)),rp=n1*.6+n2*.4;
F gl=pow(S(.6,.92,n2*1.1+.25*n1),2.2),ed=min(min(vU.x,1.-vU.x),min(vU.y,1.-vU.y)),fe=S(.24,.03,ed)*S(.42,.68,rp+.12*sin(t*2.+vW.x*20.))*vR.z,rf=S(.68,.88,n1*n2*1.5)*vR.z*.6;
c=M(uC*uL*(.85+.3*rp),wh,C(gl*.85+fe*.8+rf));a=C((gl*.48+fe*.5+rf*.34+S(.52,.8,rp)*.15)*bf(vU,.16)*vR.w)*(.2+.65*lm);}
else if(uK<1.5){F k=vR.x,st=vR.y*(.36+.64*lm);
if(k<.5){F h=1.-vU.y,tu=sqrt(h+.06),s1=vn(V2(vU.x*11.,tu*5.2-t*2.1)),s2=vn(V2(vU.x*24.+2.3,tu*9.5-t*3.8)),sr=S(.35,.75,s1*.65+s2*.45),ft=S(.62,1.,h)*(.65+.35*s2);
c=M(uC*uL*V3(.72,.88,.96),wh,C(sr*.68+ft*.8));a=(.3+.44*sr+.32*ft)*bf(vU,.12)*st;}
else if(k<1.5){F r=L(q),n1=vn(V2(atan(q.y,q.x)*3.+r*6.,r*7.-t*2.4)),rg=SN(r*18.-t*5.5+n1*3.);c=M(uC*uL,wh,.6+.35*rg);a=S(1.,.15,r)*(.32+.45*n1*rg+.3*(1.-r)*(1.-r))*st;}
else{F m1=vn(vU*V2(4.,3.)-V2(t*.18,t*.65)),m2=vn(vU*V2(7.,5.)+V2(t*.25,-t*.95));c=M(uC*uL,wh,.7);a=S(1.,.2,L(q))*S(.32,.78,m1*.6+m2*.5)*(1.-vU.y*.55)*.38*st;}a=min(a,.85);}
else if(uK<2.5){F tf=t*vR.x;c=uFC*uL;a=clamp(S(.32,.82,vn(vU*V2(3.6,2.2)+V2(tf+vR.y*11.,vR.y*5.)))*bf(vU,.24)*S(0.,.38,1.-vU.y)*vR.z*uFM,0.,.2);if(a>.004)a*=hdF(vW);}
else if(uK<3.5){F k=vR.w;
if(k<.5){F b=min(min(L((q-V2(-.38,-.08))*V2(1.4,2.)),L((q-V2(0.,.14))*V2(1.25,1.55))),min(L((q-V2(.36,-.05))*V2(1.45,2.)),L((q-V2(0.,-.18))*V2(.88,2.3))));
c=M(uCC,uCR,S(.74,.67,b)*(1.-S(.68,.58,b))*.55+S(-.3,.4,q.y)*.25)*uL;a=S(.78,.66,b)*S(-.55,-.35,q.y)*vA;}
else if(k<1.5){F d=abs(q.x)*1.55+abs(q.y-.18)*1.25,kt=S(.72,.64,d),tl=S(.045,.01,abs(q.x-.12*sin(q.y*8.)))*step(q.y,-.35)*step(-.95,q.y);c=(kt>=.5?M(V3(.92,.3,.24),V3(.99,.86,.42),S(.42,.12,d)):V3(.98,.88,.58))*uL;a=max(kt,tl)*vA;}
else if(k<2.5){F r=L(V2(q.x,q.y+.75));c=(.55+.45*cos(T*(C((r-.72)/.32)*.82+V3(0.,.33,.67))))*uL;a=S(.22,0.,abs(r-.88))*S(-.1,.15,q.y)*S(1.,.65,abs(q.x))*vA;}
else{c=V3(1.,.96,.82)*1.2;a=C(exp(-L((q-V2(.55,-.15))*4.)*3.5)+exp(-abs(q.y+q.x*.25)*28.)*S(-.9,.55,q.x)*S(.7,.5,q.x)*.85)*vA;}}
else{F d=L(q),cr=S(.11,0.,abs(d-.9)),sh=S(.13,0.,abs(d-.74))*.55,m=max(cr,sh);c=M(V3(.06,.18,.24)*uL,wh,cr/max(m,1e-3));a=vA*m*(.4+.6*lm);}
${TK}if(a<.004)discard;FC=V4(c,a);}`;

const PT_VS=`${UH}uniform V4 uG;uniform F uI;attribute V4 aA,aB,aC;varying V4 vC;varying F vK;${AV}
void main(){F k=aA.x,sd=aA.y,sz=aA.z,al=aA.w*uI,sp=aB.w,t=uT,tw=1.;V3 p=Q;
if(k<.5){p+=V3(sin(t*sp+sd*T)*aB.x,sin(t*sp*1.3+sd*11.)*aB.y,cos(t*sp*.8+sd*9.)*aB.z);
if(uG.w>.001){F an=t*2.1+sd*T;p=M(p,uG.xyz+V3(cos(an)*.045,.025+.02*sin(an*1.7),sin(an)*.035),uG.w*S(.9,.05,L(Q-uG.xyz)));}
tw=M(.75,.28+.72*pow(SN(t*(2.2+sd*1.8)+sd*21.),2.6),uM);}
else if(k<1.5){p.y+=.004*sin(t*1.6+sd*T);tw=M(.9,.82+.18*sin(t*2.4+sd*17.),uM);}
else if(k<2.5){F cy=fract(t*sp+sd);p+=V3(sin(t*1.2+sd*15.)*aB.x,cy*aB.y,cos(t*1.1+sd*12.)*aB.z);tw=M(.6,sin(cy*P)*(.65+.35*sin(t*5.+sd*30.)),uM);}
else if(k<3.5){F cy=fract(t*sp+sd);p+=V3(sin(t*2.6+sd*19.)*aB.x*(1.+cy),cy*aB.y,cos(t*2.2+sd*13.)*aB.z);tw=M(.5,(1.-cy)*S(0.,.12,cy),uM);}
else if(k<4.5){F cy=fract(sd+t*.045),rd=aC.w*.5*sin(t*.7+sd*14.);p+=V3(aB.x*cy+rd,cy*aB.z,aB.y*cy+rd*.5);tw=M(.5,sin(cy*P)*(.55+.45*sin(t*1.8+sd*25.)),uM);}
else{F ph=t*sp+sd*T;p+=V3(sin(ph)*aB.x,sin(ph*2.)*aB.y,cos(ph*1.3)*aB.z);tw=.7;}
if(k<.5||k>1.5)p=avH(p);V4 c=PV*V4(p,1.);GP=c;GP.z-=2e-4*c.w;
gl_PointSize=clamp(sz*uH*.5*projectionMatrix[1][1]/max(c.w,.05),k>4.5?2.:3.,k<1.5&&k>.5?68.:26.);vC=V4(aC.rgb,al*tw);vK=k;}`;
const PT_FS=`${UH}varying V4 vC;varying F vK;
void main(){V2 q=gl_PointCoord*2.-1.;F d=L(q),m=0.;V3 c=vC.rgb;
if(vK<.5){m=exp(-d*d*4.5)*S(1.,.6,d);c=M(c,V3(1.,1.,.92),exp(-d*d*12.));}
else if(vK<1.5)m=exp(-d*d*3.)*S(1.,.45,d);
else if(vK<2.5){V2 r=abs(q);m=C((S(1.,0.,r.x*6.+r.y)+S(1.,0.,r.y*6.+r.x))*.8+exp(-d*d*7.));}
else if(vK<3.5){m=S(1.,.3,L(q*V2(1.8,1.)));c=M(V3(.95,.28,.06),V3(1.3,.85,.3),S(.8,.1,d));}
else if(vK<4.5)m=exp(-d*d*5.5)*S(1.,.6,d);else m=S(.9,.35,d);
F a=vC.a*m;${TK}if(a<.004)discard;FC=V4(c,min(a,1.));}`;

const DR_VS=`${UH}uniform V2 uW;attribute V3 aP;attribute V4 aD,aR,aC;varying V2 vU;varying V4 vC;varying F vK;${AV}
V3 r3(V3 v,V3 k,F a){return v*cos(a)+cross(k,v)*sin(a)+k*dot(k,v)*(1.-cos(a));}
void main(){if(uM<.5){GP=V4(2.,2.,2.,1.);return;}vU=uv;vK=aC.a;F sd=aR.x,sp=aR.y,dh=aR.z,t0=aR.w,lf=4.5,ag=0.;
if(t0>0.){ag=uRT-t0;lf=2.8+sd*1.4;if(ag<0.||ag>lf){GP=V4(2.,2.,2.,1.);return;}}else ag=fract(uT*sp+sd)*lf;
F u=ag/lf;V3 p=avH(aP+V3(uW.x*ag*(.06+.04*sd)+.035*sin(ag*2.1+sd*19.)+(t0>0.?(aD.z-.5)*.24*u:0.),-dh*u,uW.y*ag*.02+.02*cos(ag*1.7+sd*13.)+(t0>0.?(aD.w-.5)*.16*u:0.)));
GP=PV*V4(p+r3(V3(Q.x*aD.x,Q.y*aD.y,0.),normalize(V3(.4+sd,.8,-.5+sd*.7)),ag*(2.6+sd*2.4)+sd*T),1.);vC=V4(aC.rgb,S(0.,.12,u)*S(1.,.82,u));}`;
const DR_FS=`${UH}uniform V3 uL;varying V2 vU;varying V4 vC;varying F vK;
void main(){V2 q=vU*2.-1.;F m=0.;V3 c=vC.rgb*uL;
if(vK<.5){F e=L(V2(q.x/(.66-.22*q.y),q.y*1.05+.1*q.x*q.x));m=S(1.,.8,e);c=M(c*V3(.62,.42,.48),c,S(.96,.68,e))*(.94+.1*S(.14,0.,abs(q.x)));}
else{F w=.52*(1.-q.x*q.x);m=S(.05,-.03,abs(q.y)-w)*step(abs(q.x),1.);c=M(c*.65,c,S(w,w*.45,abs(q.y)))*(.9+.12*S(.08,0.,abs(q.y)));}
F a=vC.a*m;${TK}if(a<.01)discard;FC=V4(c,a);}`;

const CR_VS=`${UH}uniform V4 uRC[8];attribute V3 aP;attribute V4 aE,aB,aR;varying V2 vU;varying F vA,vG;${AV}
void main(){F bh=aB.x,cl=aB.y,sp=aB.z,ph=aB.w,id=aR.x,asp=aR.y,sz=aE.w,ax=aR.w,t=uT,rA=-1.;V2 rP=V2(0.);
for(int i=0;i<8;i++)if(abs(uRC[i].x-id)<.25&&uRC[i].y>=0.){rA=uRT-uRC[i].y;rP=uRC[i].zw;}
F pt=t*sp+ph*T,fc=cos(pt)*(aE.x-aP.x)>=0.?1.:-1.,fl=0.,ar=0.,rz=0.,sc=1.,al=1.,gl=0.;V3 p=M(aP,aE.xyz,SN(pt));
if(bh<.5){if(uM<.5){p=aE.xyz;fc=aR.z;}else{F cy=fract(t*sp+ph),pc=S(.36,.42,cy)*(1.-S(.64,.7,cy));V3 eP=V3(aP.x+aR.z*1.15,aP.y+.03,aP.z);
if(cy<.42){F u=cy/.42;p=M(aP,aE.xyz,S(0.,1.,u));p.y+=.07*sin(u*P);fc=sign(aE.x-aP.x);}
else if(cy<.64){p=aE.xyz;fc=aR.z;}else{F u=(cy-.64)/.36;p=M(aE.xyz,eP,S(0.,1.,u));p.y+=.09*sin(u*P);fc=sign(eP.x-aE.x);}
fl=(1.-pc)*sin(t*(11.+ax*3.)+ph*19.)*.42;p.y+=(1.-pc)*.006*sin(t*9.+ph*11.);al=S(0.,.06,cy)*S(1.,.94,cy);
if(rA>=0.&&rA<3.6){F s=sin(C(rA/3.6)*P),an=ph*T+rA*1.8;p+=V3(cos(an)*.16*s,.11*s,sin(an)*.08*s);fl=sin(uRT*18.+ph*10.)*.55;al=1.;}}p=avH(p);}
else if(bh<1.5){if(uM<.5)p=aP;else{p.y+=.045*sin(pt*2.+1.)+.018*cos(pt*3.);F st=rA>=0.&&rA<3.8?S(0.,.5,rA)*S(3.8,3.1,rA):0.;if(st>.001)p=M(p,V3(rP.x,max(aP.y-.02,.055),rP.y),st);fl=sin(t*M(13.,3.5,st)+ph*15.)*M(.52,.18,st);}p=avH(p);}
else if(bh<2.5){if(uM<.5)p=aP;else{if(ax>.5){F dr=S(.2,.8,fract(pt*.35));p=M(aP,aE.xyz,SN(floor(pt*.35)*1.7+dr*1.7));}p.y+=.025*sin(pt*2.3);if(rA>=0.&&rA<2.){F s=sin(rA*1.5708);p.y+=.09*s;p.x+=.05*sin(rA*6.)*s;}fl=sin(t*26.+ph*17.)*.38;}p=avH(p);}
else if(bh<3.5){if(uM<.5)p=aP;if(rA>=0.&&rA<3.){if(rA<2.5)cl=aR.z;sc=1.-.12*uM*S(0.,.18,rA)*(1.-S(2.4,3.,rA));}}
else if(bh<4.5){if(uM<.5)p=aP;else{ar=SN(t*4.5+ph*11.)*.18;if(rA>=0.&&rA<1.8){ar=.35*abs(sin(rA*9.));sc=1.+.08*sin(rA*10.);}}}
else if(bh<5.5){if(uM<.5)p=aP;else{if(ax>.5){p=M(aP,aE.xyz,fract(t*sp+ph));fc=sign(aE.x-aP.x);}if(rA>=0.&&rA<1.6){p.x+=fc*.045*sin(rA/1.6*P);p.y+=.008*abs(sin(rA*14.));}}}
else if(bh<6.5){if(uM<.5)p=aP;else{F st=t*sp+ph*4.,k=floor(st)+S(.65,.95,fract(st));p=M(aP,aE.xyz,SN(k*1.4));if(rA>=0.&&rA<2.2)p.y+=.075*sin(rA/2.2*P);}rz=.35*sign(aE.y-aP.y);fc=aE.x>=aP.x?1.:-1.;}
else if(bh<7.5){if(uM<.5){p=aP;p.y+=.008;fc=1.;}else{F lp=rA>=0.&&rA<1.35?rA/1.35:(fract(t*sp+ph)<.34?fract(t*sp+ph)/.34:-1.);if(lp>=0.){p=M(aP,aE.xyz,lp);p.y+=(.06+.035*step(0.,rA))*sin(lp*P);rz=(1.-2.*lp)*.75;fc=aE.x>=aP.x?1.:-1.;}else{p=M(aP,aE.xyz,SN(pt*.8));p.y+=.006+.005*sin(t*3.+ph*9.);fc=cos(pt*.8)*(aE.x-aP.x)>=0.?1.:-1.;}}}
else if(bh<8.5){F hp=uM<.5?0.:(rA>=0.&&rA<.9?sin(rA/.9*P):(fract(t*sp+ph)<.16?sin(fract(t*sp+ph)/.16*P)*.65:0.));p=aP+V3(0.,.055*hp,0.);sc=1.+.06*hp;fc=aR.z>=0.?1.:-1.;}
else{F fd=sp>=.5?1.:(rA>=0.?(uM<.5?1.:S(0.,.32,rA)):0.),bn=uM<.5?0.:(rA>=0.&&rA<1.2?sin(rA*7.8)*exp(-rA*3.)*.16:0.),pk=(1.-fd)*uM*max(0.,sin(t*1.2+ph*17.)-.65)*2.8;
p=M(aP-V3(0.,sz*.24,0.),aE.xyz,fd)+V3(0.,pk*.01+max(0.,bn)*.04,0.);sc=M(.55,1.15,fd)*(1.+bn);fc=aR.z>=0.?1.:-1.;al=M(.62,1.,fd);gl=fd*(rA>=0.&&rA<2.2?S(2.2,0.,rA):0.);}
if(fc==0.)fc=1.;V3 l=V3(Q.x*sz*asp*sc,(Q.y+.5)*sz*sc,0.);l.y+=ar*sz*(1.-4.*Q.x*Q.x)+abs(Q.x)*sz*abs(fl)*.35;l.z+=abs(Q.x)*sz*fl;l.x*=fc;
if(abs(rz)>.001){F c=cos(rz),s=sin(rz);l.xy=mat2(c,-s,s,c)*l.xy;}
GP=PV*V4(p+l,1.);GP.z-=1.5e-4*GP.w;vU=V2((mod(floor(cl+.5),4.)+uv.x)*.25,(floor((cl+.5)/4.)+(1.-uv.y))*.25);vA=al;vG=gl;}`;
const CR_FS=`${UH}uniform sampler2D uA;uniform V3 uN;varying V2 vU;varying F vA,vG;
void main(){V4 t=texture2D(uA,vU);F a=t.a*vA;${TK}if(a<.35)discard;FC=V4(t.rgb*uN*(.72+.28*vA)+V3(1.,.92,.62)*vG*.42,a);}`;

function mkI(n,geo,VS,FS,u,S,nm,o=4){
  const g=new THREE.InstancedBufferGeometry(),F={},ks=Object.keys(S);g.index=geo.index;g.setAttribute("position",geo.attributes.position);g.setAttribute("uv",geo.attributes.uv);g.instanceCount=n;
  for(const k of ks)g.setAttribute(k,new THREE.InstancedBufferAttribute(F[k]=new Float32Array(n*S[k]),S[k]));
  return{m:Object.assign(new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,side:THREE.DoubleSide})),{name:nm,frustumCulled:false,renderOrder:o,raycast:()=>{}}),g,F,ks,put(i,...v){ks.forEach((k,j)=>F[k].set(v[j],i*S[k]));}};
}

const WRE=/(?:^|-)(?:water|river|stream|pond|lake|sea|lagoon|canal|marsh)(?:-|$)/i;
const WEX=/dry|bed|mud|basin|pot|jar|bowl|cloud|sky|bridge|boat|lotus|scroll|banner|wall|floor|carpet|reed|bank|boulder|rock/i;
const NPUP=/^(?:sun-\d|web-rung|sky-net|fallen-|falcon-|silver-carp|tiny-tail|spring-lantern|cloud|petal|splash|fruit|star-\d)/i;
const RE={
  sea:/\b(sea|ocean|coral|beach|ship|harbour|lagoon|reef|tide)\b/i,mountain:/waterfall|cascade|cliff|peak|mountain|cave/i,
  palace:/palace|hall|throne|banquet|gate|pavilion|temple|court|shrine/i,river:WRE,
  garden:/peach|orchard|garden|flower|peony|meadow|blossom/i,forest:/forest|bamboo|jungle|wood|grove|pine|tree/i,
  village:/village|hut|house|market|stall|barn|farm|fence|well/i,fall:/waterfall|cascade/i,
  tree:/tree|peach|pine|palm|bamboo|canopy|bough|orchard|shrub|branch|grove|willow|jamun|osmanthus/i,
  roof:/roof|pavilion|gate|palace|temple|shrine|house|hut|arch|pagoda|colonnade|hall|stall/i,
  lantern:/lantern|lamp|candle|brazier|fire|flame|torch|incense|tripod/i,
  rock:/rock|stone|boulder|crag|ledge|kerb|bench|wall|pillar|stair|log|reed|fern|grass|bush|basket|table|screen/i,
  wall:/wall|pillar|gate|arch|colonnade|pavilion|palace|screen|stair/i,magic:/magic|staff|peach|moon|lotus|spirit|pearl|jade|gourd|star|firebird/i,
};

function derivePlan(sp,rt,cd,bd,pg){
  const m=sp.m||{},ov=m.life&&typeof m.life==="object"?m.life:{},st=m.stage?.name||"day",all=[],sn=new Set(),b=new B3(),sz=new V3(),c=new V3();
  const add=(o,n)=>{if(!n||sn.has(n)||/^(page|leaf|words|surround|nook|life-fx|paper-static)/i.test(n))return;b.setFromObject(o);if(b.isEmpty())return;b.getSize(sz);b.getCenter(c);if(sz.x<.005&&sz.y<.005)return;sn.add(n);all.push({n,y0:b.min.y,y1:b.max.y,cx:c.x,cz:c.z,w:sz.x,h:sz.y,d:sz.z});};
  cd.forEach(x=>add(x.g,x.g.name||x.name));rt.traverse(o=>o.name&&(o.isGroup||o.isMesh)&&o.parent===rt&&add(o,o.name));
  const nm=all.map(a=>a.n).join(" "),bl=`${nm} ${(m.touch||[]).join(" ")}`,hw=(m.ambient?.water?.ripple??0)>0;
  const bm=ov.biome||(["sea","mountain","palace","river","garden","forest","village"].find(k=>k==="sea"?RE.sea.test(bl)&&!/cloud-sea/i.test(bl):k==="river"?hw||all.some(a=>WRE.test(a.n)&&!WEX.test(a.n)):RE[k].test(bl))??(st==="night"?"night-sky":"garden"));
  const Y=pg.max.y,x0=pg.min.x+.08,x1=pg.max.x-.08,z0=pg.min.z+.06,z1=pg.max.z-.06,sky={x0:bd?bd.x0+.05:x0,x1:bd?bd.x1-.05:x1,y:bd?bd.top-.04:Y+.62,z:(bd?.z??z0)+.045},yT=sky.y-.04;
  const s={water:[],waterfall:[],trees:[],roofs:[],lanterns:[],fires:[],rocks:[],walls:[],magic:[],sky,...(ov.spots||{})};
  const by=(re,n=8)=>all.filter(a=>re.test(a.n)&&!/sky|mist|cloud|backdrop/i.test(a.n)).slice(0,n),fi=(k,re,n,fn)=>!s[k].length&&by(re,n).forEach(a=>{const v=fn(a);v&&s[k].push(v);});
  fi("trees",RE.tree,8,a=>a.h>.06&&{name:a.n,x:a.cx,y:min(a.y1-.02,yT),z:a.cz,w:min(.32,a.w)});
  fi("roofs",RE.roof,6,a=>a.h>.12&&{x:a.cx,y:min(a.y1-.01,yT),z:a.cz+.015});
  if(!s.lanterns.length&&!s.fires.length)by(RE.lantern).forEach(a=>(/brazier|fire|flame|torch|incense|tripod/i.test(a.n)?s.fires:s.lanterns).push({x:a.cx,y:a.y0+a.h*.72,z:a.cz+.015}));
  fi("rocks",RE.rock,10,a=>a.h<.35&&abs(a.cx)>.08&&{x:a.cx,y:max(Y,a.y0),top:min(Y+.14,a.y1),z:cl(a.cz+.02,z0,z1)});
  fi("walls",RE.wall,4,a=>a.h>.18&&{x:a.cx+(a.cx>=0?-.05:.05),y0:Y+.05,y1:min(a.y1-.04,Y+.28),z:a.cz+.02});
  fi("magic",RE.magic,6,a=>({x:a.cx,y:a.y0+a.h*.55,z:a.cz+.015}));
  if(!s.water.length&&!ov.spots){by(WRE,3).filter(a=>!WEX.test(a.n)).forEach(a=>s.water.push({x:a.cx,y:Y,z:cl(a.cz,z0+.05,z1-.04),w:cl(a.w,.14,.7),d:cl(max(a.d,.16),.12,.4)}));if(!s.water.length&&hw)s.water.push({x:0,y:Y,z:(z0+z1)*.5+.06,w:(x1-x0)*.72,d:(z1-z0)*.36});}
  fi("waterfall",RE.fall,2,a=>({x:a.cx,y0:Y+.01,y1:min(a.y1,Y+.28),z:a.cz+.02,w:cl(a.w*.5,.06,.16)}));
  if(s.rocks.length<3)s.rocks.push({x:x0+.16,y:Y,top:Y+.04,z:z1-.12},{x:x1-.16,y:Y,top:Y+.04,z:z1-.12},{x:-.18,y:Y,top:Y+.05,z:z1-.18});
  if(!s.trees.length&&/garden|forest|mountain|river/.test(bm))s.trees.push({name:"canopy-l",x:x0+.16,y:Y+.38,z:z0+.18,w:.26},{name:"canopy-r",x:x1-.16,y:Y+.38,z:z0+.18,w:.26});
  for(const k of Object.keys(s))if(Array.isArray(s[k]))s[k]=s[k].map(o=>!o.at?o:k==="waterfall"?(([x,,z])=>({...o,x,y0:Y+(o.y0??.01),y1:Y+(o.y1??.24),z}))(B(o.at)):(([x,y,z])=>({...o,x:o.x??x,y:o.y??max(Y,y),z:o.z??z}))(B(o.at)));
  const ind=typeof ov.indoor==="boolean"?ov.indoor:(/banquet-hall|throne|banquet-table|palace-hall|inner-hall|chamber|carpet|silk-screen|king-throne/i.test(bl)||(bm==="palace"&&!/gate|sky|cloud|mountain|cliff|garden|orchard|courtyard|village|river|sea|pond|waterfall|tree|pine|osmanthus|moon/i.test(nm)));
  return{bm,st,ind,S:s,finds:ov.finds||null,pc:ov.petalColor||null,sun:ov.sunShafts??(st==="day"&&!ind),rain:!!m.ambient?.rain};
}

const PAL={day:[[1,1,1],[.78,.9,.96],[.92,.95,.98],.65,[.98,.97,.94],[1,.99,.95],[1,1,1]],dusk:[[.96,.84,.72],[.92,.78,.64],[.9,.74,.62],.95,[.95,.8,.68],[1,.96,.9],[.88,.78,.68]],night:[[.52,.58,.7],[.44,.56,.76],[.38,.46,.64],1.05,[.34,.4,.56],[.5,.58,.76],[.24,.29,.38]]};

function buildLife(sc,cam,sp){
  const rt=sp.root,pa=sp.group||sc,m=sp.m||{},q=new URLSearchParams(location.search);
  if(q.get("life")==="0"||m.life===false)return null;
  const ph=innerWidth<600,Q=ph?.5:1,mq=typeof matchMedia==="function"?matchMedia("(prefers-reduced-motion: reduce)"):null;
  let rd=!!mq?.matches;
  const spm=q.get("seed"),seed=spm!=null&&spm!==""?(Number(spm)>>>0):(window.__fake?7:((Date.now()^(Math.random()*0x7fffffff|0))>>>0));
  const rng=mkRng(seed),r=(a,b)=>a+(b-a)*rng(),rr=a=>(rng()*2-1)*a,cnt=(n,mn=1)=>max(mn,round(n*Q)),rep=(n,mn,fn)=>{for(let i=0,k=cnt(n,mn);i<k;i++)fn(i);};
  const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=(rng()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};

  const pg=new B3();
  for(const n of["page-right","leaf-page"]){const o=rt.getObjectByName(n);if(o)pg.expandByObject(o);}
  if(pg.isEmpty())pg.setFromObject(rt);
  const pn=pg.min,px=pg.max,Y=px.y,cd=standing(rt),bd=sp.sky||skyline(rt,cd,m.backdrop),pl=derivePlan(sp,rt,cd,bd,pg),{bm,st,ind,S}=pl,dk=st==="night",du=st==="evening"||st==="dawn",pal=PAL[dk?"night":du?"dusk":"day"];

  const ac=(sp.cast||[]).filter(c=>{if(!c?.body)return 0;let sk=0;c.body.traverse(o=>o.isSkinnedMesh&&(sk=1));return sk||(c.c?.model?.startsWith("puppet:")&&!NPUP.test(c.name||""));}).sort((a,b)=>(b.height??b.c?.height??.1)-(a.height??a.c?.height??.1));
  const hC=window.live?.home,cZ=hC?.pos?.z??cam.position.z,tanH=tan(((hC?.fov??cam.fov)*PI)/360)*(innerWidth/max(1,innerHeight)),lx=z=>max(.09,(cZ-z)*tanH*(ph?.84:.88)),inW=(x,z)=>S.water.some(w=>abs(x-w.x)<w.w*.52&&abs(z-w.z)<w.d*.52);
  const tp=[],_tv=new V3(),_sb=new B3();
  for(const tg of(sp.play?.targets||window.live?.game?.targets||[]))if(tg?.getWorldPosition)tg.getWorldPosition(_tv),tp.push([_tv.x,_tv.z,.14]);
  for(const ch of ac)if(ch?.body?.getWorldPosition)ch.body.getWorldPosition(_tv),tp.push([_tv.x,_tv.z,.14]);
  for(const c of cd){_sb.setFromObject(c.g);_sb.getSize(_tv);if(_tv.x<.12){_sb.getCenter(_tv);if(_tv.z>.25)tp.push([_tv.x,_tv.z,.15]);}}
  const pO=(x,z,x0,x1,z0,z1)=>{for(let j=0;j<3;j++)for(const[tx,tz,mr]of tp){const dx=x-tx,dz=z-tz,d=hypot(dx,dz);if(d<mr){const k=mr/max(d,.01);x=cl(tx+(d<.01?.01:dx)*k,x0,x1);z=cl(tz+dz*k,z0,z1);}}return[x,z];};
  const clF=(x,z,mX=.22)=>{const l=ph?min(mX,lx(z)):lx(z);return pO(cl(x,-l,l),z,max(pn.x+.1,-l),min(px.x-.1,l),pn.z+.12,px.z-.08);};

  const gp=new THREE.Group();gp.name="life-fx-root";pa.add(gp);
  const ks=[],dp=[],cs=[],a8=(x,y)=>Array.from({length:8},()=>new V4(x,y,0,0)),hd=a8(0,-9),rcA=a8(-1,-99);
  let rH=0,T=0,Tm=0,qt=1,gS=0,wD=rng()<.5?1:-1,dr=0;
  const u=v=>({value:v}),C=a=>u(new CL(...a));
  const U={uT:u(0),uRT:u(0),uM:u(rd?0:1),uH:u(innerHeight),uI:u(1),uHD:u(hd),uRC:u(rcA),uG:u(new V4()),uW:u(new V2(wD*r(.75,1.35),rr(.25))),uA:u(null),uN:C(pal[0]),uC:C(pal[1]),uFC:C(pal[2]),uFM:u(pal[3]),uCC:C(pal[4]),uCR:C(pal[5]),uL:C(pal[6])};
  if(mq?.addEventListener){const f=e=>{rd=!!e.matches;U.uM.value=rd?0:1;};mq.addEventListener("change",f);dp.push(()=>mq.removeEventListener("change",f));}
  const p1=new THREE.PlaneGeometry(1,1),p2=new THREE.PlaneGeometry(1,1,2,1);dp.push(()=>(p1.dispose(),p2.dispose()));
  const mkA=(n,k,nm,o)=>mkI(n,p1,AT_VS,AT_FS,{...U,uK:u(k)},{aP:3,aD:4,aR:4},nm,o),addL=(m,k)=>{gp.add(m);if(k)ks.push(k);dr++;},dtA=I=>I.ks.forEach(k=>(I.g.attributes[k].needsUpdate=true));

  if(S.water.length){const I=mkA(S.water.length,0,"life-fx-water",2);S.water.forEach((w,i)=>I.put(i,[w.x,w.y,w.z],[w.w,w.d,0,0],[w.flowX??.35,w.flowZ??.05,w.foam??.7,w.alpha??.85]));addL(I.m,"water");}
  if(S.waterfall.length){const I=mkA(S.waterfall.length*3,1,"life-fx-waterfall",3);S.waterfall.forEach((f,i)=>{const h=max(.08,f.y1-f.y0),ln=f.lean??.04,s=f.strength??.9;I.put(i*3,[f.x,(f.y0+f.y1)*.5,f.z],[f.w,h,ln,0],[0,s,0,0]);I.put(i*3+1,[f.x,f.y0,f.z+ln+.02],[f.w*2.1,f.w*1.4,0,0],[1,s,0,0]);I.put(i*3+2,[f.x,f.y0,f.z+ln+.03],[f.w*2.4,h*.65,0,0],[2,s*.9,0,0]);});addL(I.m,"waterfall");}
  {const I=mkA(1,2,"life-fx-fog",2),pw=px.x-pn.x,pd=px.z-pn.z;I.put(0,[rr(.1)*pw*.5,Y+.018,pn.z+pd*.3],[pw*.82,.18,0,0],[wD*.045,rng(),.16,0]);addL(I.m,"fog");}
  const sky=S.sky,sup=!(spm!=null?seed%5===0:rng()<.22)||ind?null:(dk?"shooting-star":(pl.rain?"rainbow":"kite"));
  if(!ind){const nC=ph?2:3,I=mkA(nC+(sup?1:0),3,"life-fx-sky",1);for(let i=0;i<nC;i++){const w=r(.18,.28);I.put(i,[r(sky.x0,sky.x1),sky.y-r(.05,.15),sky.z+.015+i*.014],[w,w*r(.36,.45),sky.x0,sky.x1],[wD*r(.012,.026),rng(),dk?.22:.4,0]);}if(sup){const k=sup==="kite"?1:sup==="rainbow"?2:3;I.put(nC,[rr(.2),sky.y-(k===2?.12:.08),sky.z+.03],[k===2?.65:k===3?.32:.09,k===2?.32:.12,sky.x0,sky.x1],[.02,rng(),k===2?.34:.85,k]);}addL(I.m,"sky");}
  const ff=[];
  {
    const rw=[],P=(p,a,b,c)=>rw.push([...p,...a,...b,...c]),nF=!ind&&(dk?22:du?14:0);
    rep(nF,nF?4:0,i=>{const p=[(i%2?1:-1)*r(.14,.46),Y+r(.06,.28),r(pn.z+.12,px.z-.1)];P(p,[0,rng(),dk?.02:.015,dk?.95:.78],[r(.04,.09),r(.02,.05),r(.03,.07),r(.7,1.3)],[1.15,.96,.42,0]);ff.push(p);});
    S.lanterns.forEach(l=>P([l.x,l.y,l.z],[1,rng(),.09,dk?.58:.34],[0,0,0,1],[1.15,.72,.28,0]));
    const ms=S.magic.length?S.magic:[{x:-.28,y:Y+.12,z:0},{x:.28,y:Y+.12,z:0}];
    rep(14,6,i=>{const s=ms[i%ms.length];P([s.x+rr(.1),s.y+r(-.02,.06),s.z+rr(.06)],[2,rng(),.013,dk?.82:.55],[r(.02,.05),r(.12,.22),r(.02,.04),r(.14,.26)],[1.05,.94,.62,0]);});
    S.fires.forEach(f=>rep(8,3,()=>P([f.x+rr(.02),f.y,f.z+rr(.02)],[3,rng(),.011,.9],[r(.015,.035),r(.16,.28),r(.01,.02),r(.32,.55)],[1.2,.52,.14,0])));
    if(pl.sun)[-.32,.32].forEach(sx=>rep(8,4,()=>P([sx+rr(.05),Y+.03,pn.z+.28+rr(.05)],[4,rng(),.009,.52],[-.14,-.05,.44,1],[1,.94,.74,.08])));
    if(!dk&&!ind)(S.water.length?S.water:S.rocks).slice(0,2).forEach(g0=>rep(6,3,()=>P([g0.x+rr(.05),Y+r(.06,.14),g0.z+rr(.04)],[5,rng(),.0055,.45],[r(.018,.04),r(.01,.024),r(.015,.035),r(2.2,3.8)],[.32,.28,.22,0])));
    const N=rw.length,g=new THREE.BufferGeometry(),A=[3,4,4,4].map(n=>new Float32Array(N*n));
    rw.forEach((w,i)=>[0,3,7,11].forEach((o,j)=>A[j].set(w.slice(o,o+(j?4:3)),i*(j?4:3))));
    ["position","aA","aB","aC"].forEach((k,j)=>g.setAttribute(k,new THREE.BufferAttribute(A[j],j?4:3)));
    addL(Object.assign(new THREE.Points(g,new THREE.ShaderMaterial({uniforms:U,vertexShader:PT_VS,fragmentShader:PT_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})),{name:"life-fx-points",frustumCulled:false,renderOrder:5,raycast:()=>{}}),"lights");
  }
  const pB=/garden|mountain/.test(bm),pc=pl.pc||(pB?[.98,.72,.8]:[.56,.74,.36]);
  let drI=null,bH=0,BS=ph?10:16,bD=cnt(S.trees.length?12:8,5);
  if(!ind){
    drI=mkI(bD+BS,p1,DR_VS,DR_FS,U,{aP:3,aD:4,aR:4,aC:4},"life-fx-drift",4);
    for(let i=0;i<bD;i++){const tr=S.trees[i%S.trees.length],lf=!pB||i%4===3,sz=lf?r(.015,.024):r(.012,.02),x=tr?tr.x+rr(tr.w*.55):(i%2?1:-1)*r(.18,.48),y=tr?tr.y+rr(.04):Y+r(.28,.46),z=tr?tr.z+rr(.08):r(pn.z+.1,px.z-.1);drI.put(i,[x,y,z],[sz,sz*(lf?.62:.85),.5,.5],[rng(),r(.11,.22),max(.15,y-Y-.005),0],lf?[.46+r(0,.18),.66+r(0,.14),.28,1]:[pc[0],pc[1]+r(-.08,.12),pc[2]+rr(.07),0]);}
    for(let i=bD;i<bD+BS;i++)drI.put(i,[0,0,0],[.01,.01,.5,.5],[rng(),.2,.3,-99],[1,1,1,0]);addL(drI.m,"drift");
  }
  const drop=(tr,hc=false)=>{
    if(drI){const n=ph?8:14;for(let k=0;k<n;k++){const sz=r(.014,.022);drI.put(bD+((bH+k)%BS),[tr.x+rr(.08),tr.y+r(-.03,.05),tr.z+rr(.05)],[sz,sz*.82,rng(),rng()],[rng(),.22,max(.12,tr.y-Y-.004),T+k*.03],[pc[0],pc[1]+r(-.06,.1),pc[2]+rr(.06),0]);}bH=(bH+n)%BS;dtA(drI);}
    anc.position.set(tr.x,tr.y,tr.z);return fire("tree-petals",tr.name||"tree","leaves-rustle",false,hc?null:cardOf(pB?"ptree":"tree"));
  };
  let rI=null,rgH=0;
  if(S.water.length){rI=mkA(16,4,"life-fx-rings",3);for(let i=0;i<4;i++){const w=S.water[i%S.water.length];rI.put(i,[w.x+rr(w.w*.2),w.y,w.z+rr(w.d*.18)],[0,0,0,0],[r(0,5),1.5,r(.024,.04),r(4.5,7.5)]);}for(let i=4;i<16;i++)rI.put(i,[0,Y,0],[0,0,0,0],[-99,-1,.05,0]);addL(rI.m);}
  const ring=(x,z,R=.06,d=0)=>{if(!rI)return;rI.put(4+(rgH++%12),[x,S.water[0]?.y??Y,z],[0,0,0,0],[T+d,1.4,R,0]);dtA(rI);};

  const addC=(k,b,c,s,a,p0,p1,sp,d=1,ax=0,p=rng(),nm=k,h=false)=>(cs.push({id:cs.length,k,nm,b,c,s,a,p0,p1,sp,d,ax,ph:p,h,f:false}),cs.length-1);
  const vw=ph?S.water.find(w=>abs(cl(0,w.x-w.w*.36,w.x+w.w*.36))<=lx(w.z)):S.water[0],wB=vw&&[vw.x-vw.w*.38,vw.x+vw.w*.38,vw.z-vw.d*.34,vw.z+vw.d*.34];
  const pr=S.roofs.find(o=>abs(o.x)<=lx(o.z))||S.trees.find(o=>abs(o.x)<=lx(o.z))||{x:0,y:Y+.32,z:sky.z+.1},flk=[];
  if(!dk&&!ind){
    rep(4,2,i=>flk.push(addC("bird",0,13,r(.062,.072),1,[wD>0?sky.x0+.06:sky.x1-.06,sky.y-r(.06,.14)-i*.012,sky.z+.05+i*.015],[cl(pr.x,-lx(pr.z)*.8,lx(pr.z)*.8)+(i-1.5)*.032,pr.y+.005,pr.z+.01],.065,wD,rng(),.08+i*.025)));
    const fy=Y+r(.11,.17),fl=[["butterfly",3,1,.056,1.38],["butterfly",4,1,.056,1.38],["bee",5,2,.054,1]];if(vw)fl.push(["dragonfly",6,2,.066,1.4]);
    shuf(fl).slice(0,cnt(fl.length,2)).forEach(([nm,cll,b,sz,asp],i)=>{const sg=i%2?1:-1,ws=nm==="dragonfly"&&vw,z0=ws?ws.z:r(pn.z+.18,.16),l=lx(z0);addC(nm,b,cll,sz,asp,[ws?cl(ws.x-.08,-l,l):ph?sg*r(.05,min(.14,l*.7)):sg*r(.14,.26),fy+i*.014,z0],[ws?cl(ws.x+.08,-l,l):ph?sg*r(.08,min(.18,l*.85)):sg*r(.2,.32),fy+.03,z0+rr(.05)],r(.45,.75),1,nm==="dragonfly"?1:0);});ks.push("flyers");
  }
  const rks=shuf(S.rocks),rk=i=>rks[i%rks.length],cr=(s,k,b,c,sz,a,dx,sp,d=1,ax=0,p=rng())=>{const[x,z]=clF(s.x,s.z+.012,.18);if(!inW(x,z))addC(k,b,c,sz,a,[x-dx,Y,z],[x+dx,Y,z],sp,d,ax,p);};
  if(!ind)cr(rk(0),"snail",3,0,.064,1.75,.04,.16,1);
  if(!dk&&!ind)cr(rk(1),"caterpillar",4,2,.06,2,.038,.24);
  cr(rk(2),"beetle",5,7,.056,1.7,.042,.35);
  if(!dk&&!ind)for(let i=0;i<(ph?2:3);i++)cr(rk(3),"ant",5,14,.044,1.5,.05,.12,1,1,i*.14);
  const vW=S.walls.filter(w=>abs(w.x)<=lx(w.z)&&tp.every(([tx,tz,mr])=>hypot(w.x-tx,w.z-tz)>mr*.8));if(vW.length){const w=vW[(rng()*vW.length)|0];addC("lizard",6,8,.064,1.7,[w.x,w.y0,w.z],[w.x+.025,w.y1,w.z],.26);}ks.push("crawlers");
  if(vw){const[fx,fz]=pO(ph?cl(0,wB[0],wB[1]):vw.x,vw.z,...wB);if(!ph||abs(fx)<=lx(fz)){const frx=cl(fx+(fx>vw.x?-.055:.055),wB[0],wB[1]),frz=cl(fz+.02,wB[2],wB[3]);addC("fish",7,9,.076,.9,[max(wB[0],fx-.035),vw.y,fz],[min(wB[1],fx+.035),vw.y,fz],.18);addC("frog",8,10,.066,1.3,[frx,vw.y,frz],[frx,vw.y,frz],.16,frx>vw.x?-1:1);ks.push("waterlife");}}

  const okK=k=>(!dk||!/^(butterfly|bird|bee)$/.test(k))&&(k!=="frog"||!!vw)&&(!ind||/^(cat|lizard|cricket|beetle)$/.test(k));
  const rf=(pl.finds?pl.finds.map(f=>{
    const p0=f.at?B(f.at):[f.x,f.y??Y,f.z],y0=max(Y,p0[1]),sz=max(.064,f.size??.066),nm=f.name||f.kind,cll=CELL[f.sprite||f.kind]??11,d=f.dir??1;
    if(f.kind==="frog"){if(!vw)return null;const fx=cl(p0[0],wB[0],wB[1]),fz=cl(p0[2],wB[2],wB[3]);return ph&&abs(fx)>lx(fz)?null:[f.kind,nm,10,sz,[fx,vw.y,fz],[cl(fx+(f.dx??.03),wB[0],wB[1]),vw.y+.015,fz+.015],d];}
    if(ph&&abs(p0[0])>lx(p0[2]))return null;
    if(y0>Y+.04)return[f.kind,nm,cll,sz,[p0[0],y0,p0[2]],[p0[0]+(f.dx??.03),y0+(f.dy??.025),p0[2]+.025],d];
    const[x0,z0]=clF(p0[0],p0[2],.22);return inW(x0,z0)?null:[f.kind,nm,cll,sz,[x0,Y,z0],[x0+(f.dx??.04),Y+(f.dy??.02),z0+.02],d];
  }).filter(Boolean):(()=>{
    const o=[],r0=rk(0),r1=rk(1),r2=rk(2),ro=S.roofs.find(x=>abs(x.x)<=lx(x.z)),tr=S.trees.find(x=>abs(x.x)<=lx(x.z)),wl=vW[0];
    const hg=(k,c,s,x,z,dx,dy,d=1)=>{const[a,b]=clF(x,z,.2);if(!inW(a,b))o.push([k,k,c,s,[a,Y,b-.01],[a+dx,Y+dy,b+.02],d]);};
    hg("cricket",11,.064,r0.x-.03,r0.z,.045,.015);ro?o.push(["cat","cat",12,.074,[ro.x,ro.y-.02,ro.z],[ro.x,ro.y+.01,ro.z+.02],1]):hg("cat",12,.074,r1.x,r1.z,.03,.01,-1);
    if(tr&&!dk&&!ind)o.push(["bird","bird",13,.066,[tr.x+(tr.x>0?.12:-.12),tr.y-.03,tr.z],[tr.x+(tr.x>0?.08:-.08),tr.y+.02,tr.z+.02],-1]);
    if(wl)o.push(["lizard","lizard",8,.064,[wl.x,wl.y0+.04,wl.z],[wl.x+.03,wl.y0+.08,wl.z+.02],1]);
    if(vw)o.push(["frog","frog",10,.064,[vw.x,vw.y,vw.z],[cl(vw.x+.03,wB[0],wB[1]),vw.y+.015,vw.z+.02],1]);
    hg("beetle",7,.06,r2.x+.02,r2.z,-.045,.01,-1);if(!ind)hg("snail",0,.064,r1.x-.03,r1.z,.045,.008);if(!dk&&!ind)hg("butterfly",4,.064,r0.x+.04,r0.z,.02,.03);return o;
  })()).filter(([k])=>okK(k));
  if(ph&&rf.length<3)[["cricket",11,.064],["beetle",7,.06],["snail",0,.064]].filter(([k])=>okK(k)&&!rf.some(x=>x[0]===k)).forEach(([k,c,s],i)=>{if(rf.length>=3)return;const[x,z]=clF((i%2?1:-1)*.09,.24+i*.07,.14);!inW(x,z)&&rf.push([k,k,c,s,[x,Y,z],[x+(i%2?-.035:.035),Y+.015,z+.02],i%2?-1:1]);});
  for(const[k,nm,cll,sz,p0,p1,d]of shuf(rf).slice(0,cl((ind?4:3)+((rng()*2)|0),min(ind?4:3,rf.length),min(5,rf.length))))addC(k,9,cll,sz,ASP[SPR[cll]]||1.2,p0,p1,0,d,1,rng(),nm,true);ks.push("finds");

  const cI=mkI(cs.length,p2,CR_VS,CR_FS,U,{aP:3,aE:4,aB:4,aR:4},"life-fx-creatures",4);cs.forEach((c,i)=>cI.put(i,c.p0,[...c.p1,c.s],[c.b,c.c,c.sp,c.ph],[c.id,c.a,c.d,c.ax]));addL(cI.m);
  loadAtlas().then(t=>{U.uA.value=t;cs.forEach((c,i)=>{const n=SPR[c.c];if(n&&ASP[n])cI.F.aR[i*4+1]=ASP[n];});cI.g.attributes.aR.needsUpdate=true;});
  const _v0=new V3(),_v1=new V3(),_v2=new V3(),_ray=new THREE.Raycaster(),_ndc=new V2(),_pln=new THREE.Plane(new V3(0,1,0),-Y),l3=(o,a,b,u,dy=0)=>o.set(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u+dy,a[2]+(b[2]-a[2])*u),cyc=x=>((x%1)+1)%1;
  const cPos=(c,o)=>{
    const t=Tm,{p0,p1,b,sp,ph:p}=c,pt=t*sp+p*TAU;
    if(rd)return b===0?o.set(...p1):b===9?l3(o,p0,p1,c.f?1:0,c.f?c.s*.5:c.s*.2):o.set(p0[0],p0[1]+c.s*.5,p0[2]);
    if(!b){const cy=cyc(t*sp+p),u=cy<.42?cy/.42:(cy-.64)/.36;return cy<.42?l3(o,p0,p1,u*u*(3-2*u),.07*sin(u*PI)):cy<.64?o.set(...p1):l3(o,p1,[p0[0]+c.d*1.15,p0[1]+.03,p0[2]],u*u*(3-2*u),.09*sin(u*PI));}
    if(b===2&&c.ax>.5){const q0=pt*.35,d0=cl((cyc(q0)-.2)/.6,0,1);return l3(o,p0,p1,.5+.5*sin(floor(q0)*1.7+d0*d0*(3-2*d0)*1.7),.025*sin(pt*2.3)+c.s*.5);}
    if(b<=5)return l3(o,p0,p1,b>2&&c.ax>.5?cyc(t*sp+p):.5+.5*sin(pt),(b<=2?.03*sin(pt*2):0)+c.s*.5);
    if(b===6){const s0=t*sp+p*4,f=s0-floor(s0);return l3(o,p0,p1,.5+.5*sin((floor(s0)+cl((f-.65)/.3,0,1))*1.4),c.s*.5);}
    if(b===7){const cy=cyc(t*sp+p);return cy<.34?l3(o,p0,p1,cy/.34,.06*sin(cy/.34*PI)+c.s*.5):l3(o,p0,p1,.5+.5*sin(pt*.8),.008+c.s*.5);}
    return b===8?o.set(p0[0],p0[1]+c.s*.5,p0[2]):l3(o,p0,p1,c.f?1:0,c.f?c.s*.5:c.s*.2);
  };
  const anc=new THREE.Object3D(),frd=[];anc.name="life-fx-anchor";gp.add(anc);
  const stp=(id,rx=0,rz=0)=>{let s=rcA.findIndex(v=>abs(v.x-id)<.25);if(s<0)s=rH,rH=(rH+1)%8;rcA[s].set(id,T,rx,rz);};
  const fire=(kind,name,snd,hidden=false,card=null)=>(ev("ambient:sound",{name:snd,who:name}),card&&ev("ambient:tap",{name,at:anc,card}),frd.push({kind,name,hidden,t:+T.toFixed(2)}),{kind,name,hidden});
  const gth=(x,y,z)=>(U.uG.value.set(x,y,z,1),gS=1,anc.position.set(x,y,z),fire("firefly-gather","firefly","lantern-glow",false,cardOf("firefly")));
  const prj=(v,r0)=>_v1.copy(v).project(cam).z<1?[(_v1.x+1)*.5*r0.width+r0.left,(1-_v1.y)*.5*r0.height+r0.top]:null;
  const gB=L=>!!(L.game?.targets?.length&&!L.game.complete),tCtx=(cx,cy)=>{const L=window.live,el=L?.renderer?.domElement;if(!L||!el||L.mode!=="open"||gB(L))return null;const r0=el.getBoundingClientRect();_ndc.set(2*(cx-r0.left)/r0.width-1,1-2*(cy-r0.top)/r0.height);_ray.setFromCamera(_ndc,cam);return[L,r0,_ray.ray.intersectPlane(_pln,_v2)];};
  const onA=(cx,cy,r0)=>ac.some(ch=>{if(!ch?.body?.visible)return false;ch.body.getWorldPosition(_v0);const h=ch.height??ch.c?.height??.15,p=prj(_v0.set(_v0.x,_v0.y+h*.55,_v0.z),r0);return p&&hypot(cx-p[0],cy-p[1])<cl(h*170,18,36);});
  function reactC(c,wp){
    const rx=wp?wp.x:c.p0[0],rz=wp?wp.z:c.p0[2];if(!c.b)flk.forEach(fid=>stp(fid,rx,rz));else stp(c.id,rx,rz);
    if(c.b===7)ring(c.p0[0],c.p0[2],.055),ring(c.p1[0],c.p1[2],.065,1.3);if(c.b===8&&S.water.length)ring(c.p0[0],c.p0[2],.05,.15);
    if(c.h){c.f=true;cI.F.aB[c.id*4+2]=1;cI.g.attributes.aB.needsUpdate=true;}anc.position.copy(cPos(c,_v0));return fire(c.k,c.nm,sndOf(c.k),!!c.h,cardOf(c.k)||cardOf(c.nm));
  }
  function hitC(cx,cy){const ctx=tCtx(cx,cy);if(!ctx)return null;const[,r0,hf]=ctx;if(onA(cx,cy,r0))return null;let best=null,b0=ph?48:44;for(const c of cs){const p=prj(cPos(c,_v0),r0),d=p?hypot(cx-p[0],cy-p[1]):999;if(d<b0)b0=d,best=c;}return best?reactC(best,hf):null;}
  function hitE(cx,cy){
    const ctx=tCtx(cx,cy);if(!ctx)return null;const[L,r0,hf]=ctx;if(["game","reaction"].includes(L.lastTap?.kind))return null;
    if(L.lastTap?.kind==="card"&&RE.tree.test(L.lastTap.who||"")){const tr=S.trees.find(t=>t.name===L.lastTap.who)||S.trees[0];if(tr)return drop(tr,!!L.lastTap.card);}
    for(const tr of S.trees){const p=prj(_v0.set(tr.x,tr.y-.04,tr.z),r0);if(p&&hypot(cx-p[0],cy-p[1])<62)return drop(tr,!!L.lastTap?.card);}
    if(S.water.length&&hf&&S.water.some(w=>abs(hf.x-w.x)<w.w*.55&&abs(hf.z-w.z)<w.d*.55))return ring(hf.x,hf.z,.065),fire("water-ring","water","splash-small");
    if(ff.length&&hf&&!L.lastTap)return gth(cl(hf.x,pn.x+.1,px.x-.1),Y+.14,cl(hf.z,pn.z+.1,px.z-.1));return null;
  }

  const hSp=m.sound?.hush||[],cL=new CL(),cT=new CL();
  const update=dt=>{
    const L=window.live,op=!L||L.mode==="open";gp.visible=op;if(!op)return;
    dt=min(dt,.05);T+=dt;U.uRT.value=T;U.uH.value=L?.renderer?.domElement?.height||innerHeight;const iso=sc.userData.isoWash??1;U.uI.value=iso;
    const cl0=sp.page?.lines?.[sp.at],ih=cl0&&hSp.some(([a,b])=>cl0>=a&&(!b||cl0<=b));
    qt+=((iso<.95||L?.auto?.hush||ih?0:1)-qt)*min(1,dt*3);Tm+=dt*(rd?0:(.28+.72*qt));U.uT.value=Tm;
    const sN=rt.userData.stage||st,pN=PAL[sN==="night"?"night":sN==="evening"||sN==="dawn"?"dusk":"day"];
    cL.setRGB(...pN[6]).multiplyScalar(iso);U.uL.value.lerp(cL,min(1,dt*4));cT.setRGB(...pN[0]).multiplyScalar(iso);U.uN.value.lerp(cT,min(1,dt*4));
    if(gS>0)gS=max(0,gS-dt*.24),U.uG.value.w=gS*gS;
    let hi=0;for(let i=0;i<ac.length&&hi<8;i++){const ch=ac[i];if(!ch?.body?.visible)continue;ch.body.getWorldPosition(_v0);const h=ch.height??ch.c?.height??.15;hd[hi++].set(_v0.x,_v0.y+h*.82,_v0.z,max(.085,h*.38));}
    while(hi<8)hd[hi++].w=0;
  };
  const dispose=()=>(dp.forEach(f=>f()),gp.removeFromParent(),gp.traverse(o=>o.geometry&&(o.geometry.dispose(),o.material.dispose())));
  return{group:gp,biome:bm,stage:st,seed,surprise:sup,kinds:ks,update,dispose,hitCreature:hitC,hitEnv:hitE,tapAt:(x,y)=>hitC(x,y)||hitE(x,y),trigger:k=>k==="tree"&&S.trees[0]?drop(S.trees[0]):k==="firefly"&&ff.length?gth(...ff[0]):((c=>c?reactC(c,null):null)(typeof k==="number"?cs[k]:cs.find(x=>x.k===k||x.nm===k))),screenPos:c=>{const e=window.live?.renderer?.domElement,x=cs[typeof c==="number"?c:c?.id];return e&&x?prj(cPos(x,_v0),e.getBoundingClientRect()):null;},creatures:()=>cs.map(c=>({id:c.id,kind:c.k,name:c.nm,hidden:!!c.h,found:!!c.f,size:c.s,p0:c.p0,p1:c.p1})),stats:()=>({biome:bm,stage:st,indoor:ind,seed,surprise:sup,kinds:[...ks],draws:dr,creatures:cs.length,finds:cs.filter(c=>c.h).map(c=>c.nm),findsFound:cs.filter(c=>c.h&&c.f).length,reactions:frd.length,phone:ph,reduced:rd,actors:ac.length,fireflies:ff.length,uT:+Tm.toFixed(4),uMove:U.uM.value,quiet:+qt.toFixed(3),water:S.water.map(w=>[w.x,w.z,w.w,w.d])})};
}
let cur=null,pen=null;
export const life={get current(){return cur;},spread(sp,sc,cam){cur?.dispose();cur=null;pen=[sp,sc,cam];},tap(x,y){return!!cur?.hitCreature(x,y);},afterTap(x,y){cur?.hitEnv(x,y);},frame(dt){const L=window.live;if(pen&&L&&L.mode==="open"){const[sp,sc,cam]=pen;pen=null;cur=buildLife(sc,cam,sp);}cur?.update(dt);}};
