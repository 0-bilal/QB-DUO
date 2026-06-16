// ══════════════════════════════════════════════════════════════════
//  RFM.gs — طلب توريد مواد | Request for Materials
//  QB-Sentinel | برمجيات QB | بلال الخواجة
// ══════════════════════════════════════════════════════════════════

// ── إعدادات ثابتة ─────────────────────────────────────────────────
const RFM_MATERIALS_SHEET   = "RFM_Materials";
const RFM_LOG_SHEET         = "RFM_Log";
const RFM_EMAIL_SHEET       = "Emails";
const RFM_DRIVE_FOLDER_NAME = "1-8KZ8q1CFX2Exl7wc9CMtIYE-IqAoG8t";

/**
 * ⚠️ مفتاح التشفير — 64 حرف hex (= 32 بايت = AES-256)
 * يجب أن يطابق QB.rfmKey في ملف config.js
 */
const RFM_KEY = "4558414d504c454b455948455245303030303030303030303030303030303030";

/**
 * ⚠️ رابط الموقع — يُستخدم في أزرار الإيميلات
 * مثال: "https://USERNAME.github.io/QB-Sentinel"
 */
const RFM_SITE_URL = "https://0-bilal.github.io/QB-Sentinel/";

/**
 * ⚠️ معلومات مسؤول المشتريات — غيّرها قبل النشر
 */
const RFM_PURCHASE_MANAGER = {
  nameAR: "مسؤول المشتريات",
  nameEN: "BILAL",
  phone:  "0562220010"
};

/**
 * ⚠️ مواقع الفروع — بالعربي والإنجليزي
 */
const RFM_BRANCH_LOCATIONS = {
  "Dawadimi":   { ar: "الدوادمي، المنطقة الوسطى",   en: "Al-Dawadimi, Central Region"  },
  "Muzahmiyah": { ar: "المزاحمية، منطقة الرياض",    en: "Al-Muzahmiyah, Riyadh Region" }
};

// ══════════════════════════════════════════════════════════════════
//  AES-256-CBC — تنفيذ مستقل بدون مكتبات خارجية
// ══════════════════════════════════════════════════════════════════

const _S = [
  99,124,119,123,242,107,111,197, 48,  1,103, 43,254,215,171,118,
 202,130,201,125,250, 89, 71,240,173,212,162,175,156,164,114,192,
 183,253,147, 38, 54, 63,247,204, 52,165,229,241,113,216, 49, 21,
   4,199, 35,195, 24,150,  5,154,  7, 18,128,226,235, 39,178,117,
   9,131, 44, 26, 27,110, 90,160, 82, 59,214,179, 41,227, 47,132,
  83,209,  0,237, 32,252,177, 91,106,203,190, 57, 74, 76, 88,207,
 208,239,170,251, 67, 77, 51,133, 69,249,  2,127, 80, 60,159,168,
  81,163, 64,143,146,157, 56,245,188,182,218, 33, 16,255,243,210,
 205, 12, 19,236, 95,151, 68, 23,196,167,126, 61,100, 93, 25,115,
  96,129, 79,220, 34, 42,144,136, 70,238,184, 20,222, 94, 11,219,
 224, 50, 58, 10, 73,  6, 36, 92,194,211,172, 98,145,149,228,121,
 231,200, 55,109,141,213, 78,169,108, 86,244,234,101,122,174,  8,
 186,120, 37, 46, 28,166,180,198,232,221,116, 31, 75,189,139,138,
 112, 62,181,102, 72,  3,246, 14, 97, 53, 87,185,134,193, 29,158,
 225,248,152, 17,105,217,142,148,155, 30,135,233,206, 85, 40,223,
 140,161,137, 13,191,230, 66,104, 65,153, 45, 15,176, 84,187, 22
];

const _SI = [
  82,  9,106,213, 48, 54,165, 56,191, 64,163,158,129,243,215,251,
 124,227, 57,130,155, 47,255,135, 52,142, 67, 68,196,222,233,203,
  84,123,148, 50,166,194, 35, 61,238, 76,149,  11, 66,250,195, 78,
   8, 46,161,102, 40,217, 36,178,118, 91,162, 73,109,139,209, 37,
 114,248,246,100,134,104,152, 22,212,164, 92,204, 93,101,182,146,
 108,112, 72, 80,253,237,185,218, 94, 21, 70, 87,167,141,157,132,
 144,216,171,  0,140,188,211, 10,247,228, 88,  5,184,179, 69,  6,
 208, 44, 30,143,202, 63, 15,  2,193,175,189,  3,  1, 19,138,107,
  58,145, 17, 65, 79,103,220,234,151,242,207,206,240,180,230,115,
 150,172,116, 34,231,173, 53,133,226,249, 55,232, 28,117,223,110,
  71,241, 26,113, 29, 41,197,137,111,183, 98, 14,170, 24,190, 27,
 252, 86, 62, 75,198,210,121, 32,154,219,192,254, 120,205, 90,244,
  31,221,168, 51,136,  7,199, 49,177, 18, 16, 89, 39,128,236, 95,
  96, 81,127,169, 25,181, 74, 13, 45,229,122,159,147,201,156,239,
 160,224, 59, 77,174, 42,245,176,200,235,187, 60,131, 83,153, 97,
  23, 43,  4,126,186,119,214, 38,225,105, 20, 99, 85, 33, 12,125
];

const _RCON = [0,1,2,4,8,16,32,64,128,27,54];

function _gmul(a,b) {
  let p=0;
  for(let i=0;i<8;i++){
    if(b&1)p^=a;
    const h=a&0x80; a=(a<<1)&0xff; if(h)a^=0x1b; b>>=1;
  }
  return p;
}

function _keyExpand(key) {
  const N=key.length/4, R=N+6+1, w=new Uint8Array(R*16);
  for(let i=0;i<key.length;i++) w[i]=key[i];
  for(let i=N;i<R*4;i++){
    let t=[w[(i-1)*4],w[(i-1)*4+1],w[(i-1)*4+2],w[(i-1)*4+3]];
    if(i%N===0){
      const tmp=t[0]; t[0]=t[1]; t[1]=t[2]; t[2]=t[3]; t[3]=tmp;
      t=[_S[t[0]],_S[t[1]],_S[t[2]],_S[t[3]]]; t[0]^=_RCON[i/N];
    } else if(N>6&&i%N===4){ t=[_S[t[0]],_S[t[1]],_S[t[2]],_S[t[3]]]; }
    const base=(i-N)*4;
    w[i*4]=w[base]^t[0]; w[i*4+1]=w[base+1]^t[1];
    w[i*4+2]=w[base+2]^t[2]; w[i*4+3]=w[base+3]^t[3];
  }
  return w;
}

function _encBlock(blk,w) {
  const s=new Uint8Array(blk), NR=14;
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) s[r+c*4]^=w[c*4+r];
  for(let rnd=1;rnd<=NR;rnd++){
    for(let i=0;i<16;i++) s[i]=_S[s[i]];
    let t;
    t=s[1];s[1]=s[5];s[5]=s[9];s[9]=s[13];s[13]=t;
    t=s[2];s[2]=s[10];s[10]=t; t=s[6];s[6]=s[14];s[14]=t;
    t=s[15];s[15]=s[11];s[11]=s[7];s[7]=s[3];s[3]=t;
    if(rnd<NR){
      for(let c=0;c<4;c++){
        const i=c*4, a=[s[i],s[i+1],s[i+2],s[i+3]];
        s[i]=_gmul(2,a[0])^_gmul(3,a[1])^a[2]^a[3];
        s[i+1]=a[0]^_gmul(2,a[1])^_gmul(3,a[2])^a[3];
        s[i+2]=a[0]^a[1]^_gmul(2,a[2])^_gmul(3,a[3]);
        s[i+3]=_gmul(3,a[0])^a[1]^a[2]^_gmul(2,a[3]);
      }
    }
    const rb=rnd*16;
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) s[r+c*4]^=w[rb+c*4+r];
  }
  return s;
}

function _decBlock(blk,w) {
  const s=new Uint8Array(blk), NR=14;
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) s[r+c*4]^=w[NR*16+c*4+r];
  for(let rnd=NR-1;rnd>=0;rnd--){
    let t;
    t=s[13];s[13]=s[9];s[9]=s[5];s[5]=s[1];s[1]=t;
    t=s[2];s[2]=s[10];s[10]=t; t=s[6];s[6]=s[14];s[14]=t;
    t=s[3];s[3]=s[7];s[7]=s[11];s[11]=s[15];s[15]=t;
    for(let i=0;i<16;i++) s[i]=_SI[s[i]];
    const rb=rnd*16;
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) s[r+c*4]^=w[rb+c*4+r];
    if(rnd>0){
      for(let c=0;c<4;c++){
        const i=c*4, a=[s[i],s[i+1],s[i+2],s[i+3]];
        s[i]=_gmul(14,a[0])^_gmul(11,a[1])^_gmul(13,a[2])^_gmul(9,a[3]);
        s[i+1]=_gmul(9,a[0])^_gmul(14,a[1])^_gmul(11,a[2])^_gmul(13,a[3]);
        s[i+2]=_gmul(13,a[0])^_gmul(9,a[1])^_gmul(14,a[2])^_gmul(11,a[3]);
        s[i+3]=_gmul(11,a[0])^_gmul(13,a[1])^_gmul(9,a[2])^_gmul(14,a[3]);
      }
    }
  }
  return s;
}

function _hexToBytes(hex) {
  const b=new Uint8Array(hex.length/2);
  for(let i=0;i<hex.length;i+=2) b[i/2]=parseInt(hex.substr(i,2),16);
  return b;
}
function _bytesToHex(b) { return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(''); }
function _pkcs7Pad(d,bs){ const p=bs-(d.length%bs),o=new Uint8Array(d.length+p); o.set(d); o.fill(p,d.length); return o; }
function _pkcs7Unpad(d){ return d.slice(0,d.length-d[d.length-1]); }

function rfm_encrypt(plaintext, keyHex) {
  const keyBytes=_hexToBytes(keyHex), w=_keyExpand(keyBytes);
  const iv=new Uint8Array(16);
  for(let i=0;i<16;i++) iv[i]=Math.floor(Math.random()*256);
  const data=_pkcs7Pad(new Uint8Array(Utilities.newBlob(plaintext).getBytes().map(b=>b<0?b+256:b)),16);
  const result=new Uint8Array(data.length); let prev=iv;
  for(let i=0;i<data.length;i+=16){
    const block=new Uint8Array(16);
    for(let j=0;j<16;j++) block[j]=data[i+j]^prev[j];
    const enc=_encBlock(block,w); result.set(enc,i); prev=enc;
  }
  return _bytesToHex(iv)+':'+Utilities.base64Encode([...result].map(b=>b<128?b:b-256));
}

function rfm_decrypt(encStr, keyHex) {
  const parts=encStr.split(':');
  if(parts.length<2) throw new Error('bad format');
  const iv=_hexToBytes(parts[0]);
  const ct=new Uint8Array(Utilities.base64Decode(parts.slice(1).join(':')).map(b=>b<0?b+256:b));
  const w=_keyExpand(_hexToBytes(keyHex));
  const result=new Uint8Array(ct.length); let prev=iv;
  for(let i=0;i<ct.length;i+=16){
    const block=ct.slice(i,i+16), dec=_decBlock(block,w);
    for(let j=0;j<16;j++) result[i+j]=dec[j]^prev[j];
    prev=block;
  }
  return Utilities.newBlob([..._pkcs7Unpad(result)].map(b=>b<128?b:b-256)).getDataAsString();
}

function rfm_hmac(message, keyHex) {
  const keyBytes=_hexToBytes(keyHex);
  const sig=Utilities.computeHmacSha256Signature(message,Utilities.newBlob(keyBytes).getDataAsString());
  return _bytesToHex(new Uint8Array(sig.map(b=>b<0?b+256:b)));
}

// ══════════════════════════════════════════════════════════════════
//  تشفير للروابط (URL-safe)
// ══════════════════════════════════════════════════════════════════
function rfm_encodeForUrl(obj) {
  return encodeURIComponent(rfm_encrypt(JSON.stringify(obj), RFM_KEY));
}

// ══════════════════════════════════════════════════════════════════
//  إنشاء هيكل الورقات
// ══════════════════════════════════════════════════════════════════
function rfm_ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── RFM_Materials (10 أعمدة) ──────────────────────────────────
  // Branch | Supplier_Email | Supplier_Name
  // Name_AR | Name_EN
  // Current_Unit_AR | Current_Unit_EN
  // Request_Unit_AR | Request_Unit_EN | Min_Level
  let matSheet = ss.getSheetByName(RFM_MATERIALS_SHEET);
  if (!matSheet) {
    matSheet = ss.insertSheet(RFM_MATERIALS_SHEET);
    matSheet.appendRow([
      "Branch","Supplier_Email","Supplier_Name",
      "Name_AR","Name_EN",
      "Current_Unit_AR","Current_Unit_EN",
      "Request_Unit_AR","Request_Unit_EN",
      "Min_Level"
    ]);
    const hr = matSheet.getRange(1,1,1,10);
    hr.setBackground("#c62828").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    matSheet.setFrozenRows(1);
    [120,200,180,160,160,110,110,110,110,100].forEach((w,i)=>matSheet.setColumnWidth(i+1,w));

    const sampleData = [
      ["Dawadimi",  "supplier1@example.com","أبو محمد للتوريدات",  "دقيق",       "Flour",          "كيس","bag",  "كيس","bag","3"],
      ["Dawadimi",  "supplier1@example.com","أبو محمد للتوريدات",  "سكر",        "Sugar",          "كيلو","kg",  "كيلو","kg","5"],
      ["Dawadimi",  "dairy@example.com",    "شركة الألبان الذهبية","حليب سائل",  "Liquid Milk",    "لتر","liter","كرتون","carton","2"],
      ["Muzahmiyah","supplier2@example.com","شركة الفواكه الطازجة","دقيق",       "Flour",          "كيس","bag",  "كيس","bag","2"],
      ["Muzahmiyah","supplier2@example.com","شركة الفواكه الطازجة","فراولة طازجة","Fresh Strawberry","كيلو","kg","كيلو","kg","3"],
    ];
    sampleData.forEach(r=>matSheet.appendRow(r));
    matSheet.getRange(2,1,sampleData.length,10).setHorizontalAlignment("center");
  }

  // ── RFM_Log (16 عمود) ─────────────────────────────────────────
  let logSheet = ss.getSheetByName(RFM_LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(RFM_LOG_SHEET);
    logSheet.appendRow([
      "رقم الطلب","التاريخ","الوقت","الفرع","اسم الموظف",
      "عدد المواد","تفاصيل الطلب","الموردون",
      "قرار المدير","تاريخ قرار المدير","سبب رفض المدير",
      "قرار المورد","تاريخ قرار المورد","سبب رفض المورد","رابط الملف",
      "حالة الإيميل"
    ]);
    const hr=logSheet.getRange(1,1,1,16);
    hr.setBackground("#c62828").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    logSheet.setFrozenRows(1);
    logSheet.setColumnWidth(7,300); logSheet.setColumnWidth(8,220);
    logSheet.setColumnWidth(15,250);
  }
}

// ══════════════════════════════════════════════════════════════════
//  Google Drive
// ══════════════════════════════════════════════════════════════════
function rfm_getDriveFolder() {
  try {
    // RFM_DRIVE_FOLDER_NAME يحمل ID المجلد
    return DriveApp.getFolderById(RFM_DRIVE_FOLDER_NAME);
  } catch(e) {
    // إن لم يكن ID صالحاً → أنشئ مجلداً جديداً
    return DriveApp.createFolder("RFM-Quotes");
  }
}

function rfm_saveFileToDrive(base64Data, fileName, mimeType) {
  const folder=rfm_getDriveFolder();
  const blob=Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType||"application/octet-stream", fileName);
  const file=folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: file.getUrl(), id: file.getId(), name: fileName };
}

// ══════════════════════════════════════════════════════════════════
//  جلب المستلمين من Emails sheet
// ══════════════════════════════════════════════════════════════════
function rfm_getRecipients() {
  try {
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const sheet=ss.getSheetByName(RFM_EMAIL_SHEET);
    if(!sheet) return { to:"bilal15155@gmail.com", cc:"" };
    const data=sheet.getDataRange().getValues();
    let mainTo=""; const ccList=[];
    for(let i=1;i<data.length;i++){
      const email=data[i][0]?data[i][0].toString().trim():"";
      const type=data[i][3]?data[i][3].toString().trim().toLowerCase():"";
      if(email){ if(type==="to") mainTo=email; else ccList.push(email); }
    }
    return { to: mainTo||"bilal15155@gmail.com", cc: ccList.join(",") };
  } catch(e){ return { to:"bilal15155@gmail.com", cc:"" }; }
}

// ══════════════════════════════════════════════════════════════════
//  مساعدات الشيت
// ══════════════════════════════════════════════════════════════════
function rfm_findRow(sheet, trackId) {
  const d=sheet.getDataRange().getValues();
  for(let i=1;i<d.length;i++) if(String(d[i][0])===String(trackId)) return i+1;
  return -1;
}
function rfm_styleCell(sheet, row, col, bg, color) {
  sheet.getRange(row,col).setBackground(bg).setFontColor(color).setFontWeight("bold").setHorizontalAlignment("center");
}

// ══════════════════════════════════════════════════════════════════
//  doGet — جلب المواد المشفرة
// ══════════════════════════════════════════════════════════════════
function doGet(e) {
  if(!e||!e.parameter)
    return ContentService.createTextOutput(JSON.stringify({result:"error",message:"no params"}))
      .setMimeType(ContentService.MimeType.JSON);

  const action=e.parameter.action||"", branch=e.parameter.branch||"";
  const sig=e.parameter.sig||"", ts=e.parameter.ts||"";

  if(action==="getMaterials" && branch) {
    try {
      const now=Date.now(), tsNum=parseInt(ts,10);
      if(isNaN(tsNum)||Math.abs(now-tsNum)>10*60*1000)
        return ContentService.createTextOutput(JSON.stringify({result:"error",message:"expired_request"}))
          .setMimeType(ContentService.MimeType.JSON);

      if(sig!==rfm_hmac(branch+":"+ts,RFM_KEY))
        return ContentService.createTextOutput(JSON.stringify({result:"error",message:"invalid_signature"}))
          .setMimeType(ContentService.MimeType.JSON);

      rfm_ensureSheets();
      const ss=SpreadsheetApp.getActiveSpreadsheet();
      const sheet=ss.getSheetByName(RFM_MATERIALS_SHEET);
      const data=sheet.getDataRange().getValues();
      const materials=[];

      // الأعمدة: 0=Branch,1=Supplier_Email,2=Supplier_Name,
      // 3=Name_AR,4=Name_EN,5=Current_Unit_AR,6=Current_Unit_EN,
      // 7=Request_Unit_AR,8=Request_Unit_EN,9=Min_Level
      for(let i=1;i<data.length;i++){
        if((data[i][0]||"").toString().trim()===branch){
          materials.push({
            id:i,
            supplierEmail:  (data[i][1]||"").toString().trim(),
            supplierName:   (data[i][2]||"").toString().trim(),
            nameAR:         (data[i][3]||"").toString().trim(),
            nameEN:         (data[i][4]||"").toString().trim(),
            currentUnitAR:  (data[i][5]||"").toString().trim(),
            currentUnitEN:  (data[i][6]||"").toString().trim(),
            requestUnitAR:  (data[i][7]||"").toString().trim(),
            requestUnitEN:  (data[i][8]||"").toString().trim(),
            minLevel:       (data[i][9]||"").toString().trim()
          });
        }
      }

      const encrypted=rfm_encrypt(JSON.stringify({materials}),RFM_KEY);
      return ContentService.createTextOutput(JSON.stringify({result:"success",data:encrypted}))
        .setMimeType(ContentService.MimeType.JSON);

    } catch(err){
      return ContentService.createTextOutput(JSON.stringify({result:"error",message:err.toString()}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({result:"ok",service:"RFM",version:"2.0.0"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  doPost — مُوزِّع الطلبات
// ══════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    rfm_ensureSheets();
    const data = JSON.parse(rfm_decrypt(e.parameter.payload, RFM_KEY));
    switch(data.type) {
      case 'RFM_MANAGER_APPROVE':  return rfm_handleManagerApprove(data);
      case 'RFM_MANAGER_REJECT':   return rfm_handleManagerReject(data);
      case 'RFM_SUPPLIER_APPROVE': return rfm_handleSupplierApprove(data);
      case 'RFM_SUPPLIER_REJECT':  return rfm_handleSupplierReject(data);
      default:                     return rfm_handleSubmission(data);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({result:"error",message:error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════════
//  المرحلة 1 — الموظف يرسل طلباً → إيميل للمدير
// ══════════════════════════════════════════════════════════════════
function rfm_handleSubmission(data) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const logSheet=ss.getSheetByName(RFM_LOG_SHEET);
  const seqNum=Math.max(0,logSheet.getLastRow()-1)+1;
  const trackId="RFM-"+String(100+seqNum);
  const now=new Date();
  const dateStr=Utilities.formatDate(now,"GMT+3","yyyy-MM-dd");
  const timeStr=Utilities.formatDate(now,"GMT+3","HH:mm:ss");
  const items=data.items||[];

  // تجميع حسب إيميل المورد
  const supplierMap={};
  items.forEach(it=>{
    const key=it.supplierEmail||"unknown";
    if(!supplierMap[key]) supplierMap[key]={supplierEmail:it.supplierEmail,supplierName:it.supplierName,items:[]};
    supplierMap[key].items.push(it);
  });
  const supplierGroups=Object.values(supplierMap);

  const itemsDetail=items.map(it=>
    it.nameAR+": الحالي "+it.currentQty+" "+it.currentUnitAR+" / المطلوب "+it.requestedQty+" "+it.requestUnitAR
  ).join(" ،  ");
  const suppliersDetail=supplierGroups.map(g=>g.supplierName+" ("+g.supplierEmail+")").join(" | ");

  // رابط صفحة المدير
  const managerUrl=RFM_SITE_URL+"/pages/RFM-manager.html?d="+rfm_encodeForUrl({
    trackId, branch:data.branch, branchEn:data.branchEn,
    employeeName:data.employeeName, items, date:dateStr, time:timeStr, supplierGroups
  });

  let emailStatus="ناجح";
  try {
    const contacts=rfm_getRecipients();
    if(contacts.to) rfm_sendManagerEmail(data,dateStr,timeStr,trackId,supplierGroups,managerUrl,contacts);
    else emailStatus="فشل: لا يوجد بريد";
  } catch(e){ emailStatus="فشل: "+e.toString(); }

  logSheet.appendRow([
    trackId,dateStr,timeStr,data.branch,data.employeeName,
    items.length,itemsDetail,suppliersDetail,
    "قيد انتظار المدير","","",
    "—","","","",
    emailStatus
  ]);
  rfm_styleCell(logSheet,logSheet.getLastRow(),9,"#fff3e0","#e65100");

  return ContentService.createTextOutput(JSON.stringify({result:"success",id:trackId}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  المرحلة 2أ — المدير يعتمد → إيميل لكل مورد
// ══════════════════════════════════════════════════════════════════
function rfm_handleManagerApprove(data) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const logSheet=ss.getSheetByName(RFM_LOG_SHEET);
  const now=new Date();
  const dateStr=Utilities.formatDate(now,"GMT+3","yyyy-MM-dd");
  const timeStr=Utilities.formatDate(now,"GMT+3","HH:mm:ss");

  const row=rfm_findRow(logSheet,data.trackId);
  if(row>0){
    logSheet.getRange(row,9).setValue("معتمد من المدير ✓");
    logSheet.getRange(row,10).setValue(dateStr+" "+timeStr);
    rfm_styleCell(logSheet,row,9,"#e8f5e9","#2e7d32");
    logSheet.getRange(row,12).setValue("قيد انتظار المورد");
    rfm_styleCell(logSheet,row,12,"#fff3e0","#e65100");
  }

  const branchLocation=RFM_BRANCH_LOCATIONS[data.branchEn]||{ar:data.branch,en:data.branch};
  const supplierGroups=data.supplierGroups||[];
  let emailsSent=0;

  supplierGroups.forEach(group=>{
    if(!group.supplierEmail) return;
    const supplierUrl=RFM_SITE_URL+"/pages/RFM-supplier.html?d="+rfm_encodeForUrl({
      trackId:      data.trackId,
      branch:       data.branch,
      branchEn:     data.branchEn,
      employeeName: data.employeeName || "",   // يُعاد إرساله لاحقاً مع رد المورد
      supplierName:  group.supplierName,
      supplierEmail: group.supplierEmail,
      items:         group.items,
      managerNameAR: RFM_PURCHASE_MANAGER.nameAR,
      managerNameEN: RFM_PURCHASE_MANAGER.nameEN,
      managerPhone:  RFM_PURCHASE_MANAGER.phone,
      locationAR:    branchLocation.ar,
      locationEN:    branchLocation.en
    });
    try { rfm_sendSupplierEmail(group,data,supplierUrl,dateStr); emailsSent++; }
    catch(e){ console.error("Supplier email error:"+e.toString()); }
  });

  return ContentService.createTextOutput(JSON.stringify({result:"success",emailsSent}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  المرحلة 2ب — المدير يرفض
// ══════════════════════════════════════════════════════════════════
function rfm_handleManagerReject(data) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const logSheet=ss.getSheetByName(RFM_LOG_SHEET);
  const now=new Date();
  const dateStr=Utilities.formatDate(now,"GMT+3","yyyy-MM-dd HH:mm:ss");
  const row=rfm_findRow(logSheet,data.trackId);
  if(row>0){
    logSheet.getRange(row,9).setValue("مرفوض من المدير ✗");
    logSheet.getRange(row,10).setValue(dateStr);
    logSheet.getRange(row,11).setValue(data.reason||"—");
    rfm_styleCell(logSheet,row,9,"#ffebee","#c62828");
  }
  return ContentService.createTextOutput(JSON.stringify({result:"success",status:"manager_rejected"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  المرحلة 3أ — المورد يعتمد + يرفع ملف
// ══════════════════════════════════════════════════════════════════
function rfm_handleSupplierApprove(data) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const logSheet=ss.getSheetByName(RFM_LOG_SHEET);
  const now=new Date();
  const dateStr=Utilities.formatDate(now,"GMT+3","yyyy-MM-dd HH:mm:ss");

  let fileInfo=null;
  if(data.fileData&&data.fileName){
    try { fileInfo=rfm_saveFileToDrive(data.fileData,data.fileName,data.mimeType); }
    catch(e){ console.error("Drive error: "+e.toString()); }
  }

  const row=rfm_findRow(logSheet,data.trackId);
  if(row>0){
    logSheet.getRange(row,12).setValue("اعتمد المورد ✓ — "+data.supplierName);
    logSheet.getRange(row,13).setValue(dateStr);
    if(fileInfo) logSheet.getRange(row,15).setValue(fileInfo.url);
    rfm_styleCell(logSheet,row,12,"#e8f5e9","#2e7d32");
  }

  try {
    const contacts=rfm_getRecipients();
    if(contacts.to) rfm_sendManagerSupplierResponse(data,fileInfo,true,contacts);
  } catch(e){ console.error("Notify error: "+e.toString()); }

  return ContentService.createTextOutput(JSON.stringify({result:"success",fileUrl:fileInfo?fileInfo.url:null}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  المرحلة 3ب — المورد يرفض
// ══════════════════════════════════════════════════════════════════
function rfm_handleSupplierReject(data) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const logSheet=ss.getSheetByName(RFM_LOG_SHEET);
  const now=new Date();
  const dateStr=Utilities.formatDate(now,"GMT+3","yyyy-MM-dd HH:mm:ss");
  const row=rfm_findRow(logSheet,data.trackId);
  if(row>0){
    logSheet.getRange(row,12).setValue("رفض المورد ✗ — "+data.supplierName);
    logSheet.getRange(row,13).setValue(dateStr);
    logSheet.getRange(row,14).setValue(data.reason||"—");
    rfm_styleCell(logSheet,row,12,"#ffebee","#c62828");
  }
  try {
    const contacts=rfm_getRecipients();
    if(contacts.to) rfm_sendManagerSupplierResponse(data,null,false,contacts);
  } catch(e){ console.error("Notify error: "+e.toString()); }
  return ContentService.createTextOutput(JSON.stringify({result:"success",status:"supplier_rejected"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  إيميل المدير — مع زر الاعتماد/الرفض
// ══════════════════════════════════════════════════════════════════
function rfm_sendManagerEmail(data, date, time, trackId, supplierGroups, managerUrl, contacts) {
  const totalItems=supplierGroups.reduce((s,g)=>s+g.items.length,0);

  let supplierSections="";
  supplierGroups.forEach((group,gIdx)=>{
    let cards="";
    group.items.forEach((it,idx)=>{
      const bg=idx%2===0?"#f9fafb":"#ffffff";
      cards+=`<div style="background:${bg};padding:10px 14px;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:bold;color:#2d2e32;font-size:13px;margin-bottom:6px;">${it.nameAR}</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;">
          <span style="background:#f3f4f6;color:#555;padding:3px 10px;border-radius:20px;font-size:11px;">
            الحالي: <strong>${it.currentQty} ${it.currentUnitAR}</strong></span>
          <span style="background:#c62828;color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:bold;">
            المطلوب: ${it.requestedQty} ${it.requestUnitAR}</span>
        </div></div>`;
    });
    const label=supplierGroups.length>1
      ?`<span style="background:#c62828;color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:6px;">${gIdx+1}</span>`:'';
    supplierSections+=`
      <div style="margin-bottom:${gIdx<supplierGroups.length-1?'18px':'0'};">
        <div style="background:#f3f4f6;padding:9px 13px;border-radius:10px 10px 0 0;border:1px solid #e5e7eb;border-bottom:none;display:flex;align-items:center;">
          ${label}<span style="font-weight:bold;color:#2d2e32;font-size:13px;">${group.supplierName}</span>
          <span style="margin-right:auto;background:#fff;border:1px solid #e5e7eb;color:#555;padding:2px 10px;border-radius:12px;font-size:11px;">${group.items.length} مادة</span>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;margin-bottom:10px;">${cards}</div>
      </div>`;
  });

  const htmlBody=`
  <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #ddd;border-radius:15px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);padding:24px 20px;text-align:center;color:white;">
      <h2 style="margin:0;font-size:20px;">طلب توريد مواد — بانتظار اعتمادك</h2>
      <p style="margin:4px 0 0;opacity:0.75;font-size:11px;letter-spacing:1.5px;">REQUEST FOR MATERIALS — AWAITING APPROVAL</p>
      <div style="margin-top:12px;background:rgba(255,255,255,0.15);display:inline-block;padding:4px 18px;border-radius:20px;font-size:13px;">
        رقم الطلب: <strong>${trackId}</strong></div>
    </div>
    <div style="padding:20px;background:#fff;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr style="background:#f9fafb;"><td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;width:38%;">الفرع</td>
          <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;color:#000;font-weight:bold;">${data.branch}</td></tr>
        <tr><td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">الموظف</td>
          <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;color:#000;">${data.employeeName}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#555;">التاريخ والوقت</td>
          <td style="padding:9px 14px;border-bottom:1px solid #f0f0f0;color:#000;">${date} — ${time}</td></tr>
        <tr><td style="padding:9px 14px;font-weight:bold;color:#555;">الموردون</td>
          <td style="padding:9px 14px;color:#000;">${supplierGroups.length} مورد — ${totalItems} مادة</td></tr>
      </table>
      <div style="font-weight:bold;color:#c62828;font-size:14px;margin-bottom:12px;padding-bottom:7px;border-bottom:2px solid #c62828;">المواد المطلوبة</div>
      ${supplierSections}
      <div style="text-align:center;margin-top:22px;">
        <a href="${managerUrl}" style="display:inline-block;background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);color:white;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;box-shadow:0 4px 12px rgba(198,40,40,0.3);">
          مراجعة الطلب واتخاذ القرار</a>
        <p style="margin-top:8px;font-size:11px;color:#999;">REVIEW & APPROVE / REJECT REQUEST</p>
      </div>
    </div>
    <div style="background:#f8f9fa;padding:11px;text-align:center;font-size:11px;color:#777;border-top:1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB — إدارة العمليات — عصير تايم</div>
  </div>`;

  const subject=data.branch+" — طلب توريد "+totalItems+" مادة ["+trackId+"] — بانتظار اعتمادك — "+date;
  GmailApp.sendEmail(contacts.to,subject,"",{htmlBody,name:"نظام QB-Sentinel",cc:contacts.cc||""});
}

// ══════════════════════════════════════════════════════════════════
//  إيميل المورد — مع زر اعتماد/رفض
// ══════════════════════════════════════════════════════════════════
function rfm_sendSupplierEmail(group, data, supplierUrl, date) {

  // بطاقات المواد — الكمية المطلوبة فقط، نص عربي ثم إنجليزي تحته
  let cards = "";
  group.items.forEach((it, idx) => {
    const bg = idx % 2 === 0 ? "#f9fafb" : "#ffffff";
    cards += `
      <div style="background:${bg};padding:14px 16px;border-bottom:1px solid #f0f0f0;">

        <!-- اسم المادة: عربي + إنجليزي أصغر تحته -->
        <div style="font-weight:bold;color:#2d2e32;font-size:14px;margin-bottom:2px;">${it.nameAR}</div>
        <div style="font-size:11px;color:#888;margin-bottom:10px;">${it.nameEN}</div>

        <!-- الكمية المطلوبة فقط -->
        <div style="background:linear-gradient(135deg,#c62828,#8e0000);border-radius:10px;padding:10px 14px;text-align:center;">
          <div style="color:rgba(255,255,255,0.8);font-size:11px;margin-bottom:2px;">الكمية المطلوبة</div>
          <div style="color:rgba(255,255,255,0.7);font-size:9px;margin-bottom:6px;letter-spacing:0.5px;">REQUESTED QUANTITY</div>
          <div style="color:white;font-size:20px;font-weight:bold;">${it.requestedQty}</div>
          <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:3px;">
            ${it.requestUnitAR}
            <span style="opacity:0.65;font-size:10px;"> / ${it.requestUnitEN}</span>
          </div>
        </div>

      </div>`;
  });

  // بيانات المسؤول — عربي + إنجليزي
  function biRow(labelAR, labelEN, value, bg) {
    return `<tr style="background:${bg||'#fff'};">
      <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;vertical-align:top;width:42%;">
        <div style="font-weight:bold;color:#555;font-size:12px;">${labelAR}</div>
        <div style="color:#aaa;font-size:10px;">${labelEN}</div>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;color:#2d2e32;">${value}</td>
    </tr>`;
  }

  // معلومات المسؤول من الثوابت مباشرة
  const mgr      = RFM_PURCHASE_MANAGER;
  const location = RFM_BRANCH_LOCATIONS[data.branchEn] || { ar: data.branch, en: data.branch };

  const htmlBody = `
  <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #ddd;border-radius:15px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);">

    <!-- Header — عربي أولاً ثم إنجليزي تحته -->
    <div style="background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);padding:26px 22px;text-align:center;color:white;position:relative;">
      <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.04)1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04)1px,transparent 1px);background-size:28px 28px;pointer-events:none;"></div>
      <div style="position:relative;">
        <h2 style="margin:0 0 4px;font-size:21px;font-weight:800;">طلب توريد مواد</h2>
        <div style="font-size:11px;letter-spacing:1.5px;opacity:0.75;margin-bottom:14px;">REQUEST FOR MATERIALS — RFM</div>
        <div style="background:rgba(255,255,255,0.15);display:inline-block;padding:5px 20px;border-radius:20px;font-size:13px;">
          رقم الطلب: <strong>${data.trackId}</strong>
        </div>
      </div>
    </div>

    <!-- البيانات -->
    <div style="padding:22px;background:#fff;">

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
        ${biRow("الفرع", "Branch", data.branch, "#f9fafb")}
        ${biRow("موقع الفرع", "Branch Location", location.ar + '<br><span style="font-size:11px;color:#aaa;">' + location.en + '</span>')}
        ${biRow("مسؤول المشتريات", "Purchasing Manager",
          '<strong>' + mgr.nameAR + '</strong><br><span style="font-size:11px;color:#888;">' + mgr.nameEN + '</span>', "#f9fafb")}
        ${biRow("هاتف المسؤول", "Manager Phone",
          '<strong style="font-size:16px;color:#c62828;">' + mgr.phone + '</strong>')}
        ${biRow("التاريخ", "Date", date)}
      </table>

      <!-- عنوان المواد — عربي أولاً -->
      <div style="margin-bottom:12px;">
        <div style="font-weight:800;color:#c62828;font-size:15px;">المواد المطلوبة</div>
        <div style="font-size:10px;color:#aaa;letter-spacing:0.8px;text-transform:uppercase;margin-top:2px;">Requested Materials — ${group.items.length} items</div>
      </div>

      <div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:22px;">
        ${cards}
      </div>

      <!-- زر الرد -->
      <div style="text-align:center;">
        <a href="${supplierUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);color:white;padding:15px 40px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:800;box-shadow:0 6px 18px rgba(198,40,40,0.3);">
          مراجعة الطلب والرد عليه
        </a>
        <div style="margin-top:8px;font-size:11px;color:#aaa;">Respond to this order — Approve or Reject</div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:13px;text-align:center;font-size:11px;color:#777;border-top:1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB<br>
      <span style="font-size:10px;opacity:0.7;">QB-Sentinel System — Aseertime Operations</span>
    </div>
  </div>`;

  const subject = "طلب توريد — عصير تايم — فرع " + data.branch + " — " + date;
  GmailApp.sendEmail(group.supplierEmail, subject, "", {
    htmlBody, name: "عصير تايم — QB-Sentinel"
  });
}

// ══════════════════════════════════════════════════════════════════
//  إشعار المدير برد المورد — مع تفاصيل الطلب كاملة
// ══════════════════════════════════════════════════════════════════
function rfm_sendManagerSupplierResponse(data, fileInfo, approved, contacts) {
  const statusColor = approved ? "#2e7d32" : "#c62828";
  const statusBg    = approved ? "#e8f5e9" : "#ffebee";
  const statusBorder= approved ? "#a5d6a7" : "#ef9a9a";
  const statusAR    = approved ? "اعتمد المورد الطلب ✓" : "رفض المورد الطلب ✗";
  const statusEN    = approved ? "Supplier Approved the Order" : "Supplier Rejected the Order";
  const now         = new Date();
  const dateStr     = Utilities.formatDate(now, "GMT+3", "yyyy-MM-dd");
  const timeStr     = Utilities.formatDate(now, "GMT+3", "HH:mm:ss");

  // ── بطاقات المواد ─────────────────────────────────────────────
  const items = data.items || [];
  let itemsSection = "";
  if (items.length > 0) {
    let cards = "";
    items.forEach((it, idx) => {
      const bg = idx % 2 === 0 ? "#f9fafb" : "#ffffff";
      cards += `
        <div style="background:${bg};padding:11px 15px;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:bold;color:#2d2e32;font-size:13px;margin-bottom:2px;">${it.nameAR}</div>
          <div style="font-size:10px;color:#aaa;margin-bottom:7px;">${it.nameEN}</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;">
            <span style="background:#f3f4f6;color:#555;padding:3px 10px;border-radius:20px;font-size:11px;">
              الحالي: <strong>${it.currentQty} ${it.currentUnitAR||''}</strong></span>
            <span style="background:${statusColor};color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:bold;">
              المطلوب: ${it.requestedQty} ${it.requestUnitAR||''}</span>
          </div>
        </div>`;
    });
    itemsSection = `
      <div style="margin-bottom:8px;">
        <div style="font-weight:800;color:#c62828;font-size:14px;">تفاصيل المواد المطلوبة</div>
        <div style="font-size:10px;color:#aaa;text-transform:uppercase;margin-top:2px;">Order Items — ${items.length} items</div>
      </div>
      <div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">${cards}</div>`;
  }

  // ── رابط الملف ────────────────────────────────────────────────
  let fileSection = "";
  if (approved && fileInfo) {
    fileSection = `
      <div style="background:#f0fdf4;border:1px solid #a5d6a7;border-radius:10px;padding:14px;text-align:center;margin-bottom:20px;">
        <div style="color:#2e7d32;font-weight:bold;font-size:13px;margin-bottom:10px;">
          📎 الملف المرفوع من المورد
        </div>
        <a href="${fileInfo.url}"
           style="display:inline-block;background:#2e7d32;color:white;padding:11px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;">
          📄 عرض الملف / View File
        </a>
        <div style="color:#888;font-size:11px;margin-top:6px;">${fileInfo.name}</div>
      </div>`;
  }

  const htmlBody = `
  <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:20px auto;border:1px solid #ddd;border-radius:15px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);">

    <!-- Header — نفس هوية النظام -->
    <div style="background:linear-gradient(135deg,#c62828 0%,#8e0000 100%);padding:26px 22px;text-align:center;color:white;position:relative;">
      <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.04)1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04)1px,transparent 1px);background-size:28px 28px;pointer-events:none;"></div>
      <div style="position:relative;">
        <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;">رد المورد على طلب التوريد</h2>
        <div style="font-size:11px;letter-spacing:1.5px;opacity:0.75;margin-bottom:14px;">SUPPLIER RESPONSE — RFM</div>
        <div style="background:rgba(255,255,255,0.15);display:inline-block;padding:5px 20px;border-radius:20px;font-size:13px;">
          رقم الطلب: <strong>${data.trackId}</strong>
        </div>
      </div>
    </div>

    <div style="padding:22px;background:#fff;">

      <!-- بنر القرار -->
      <div style="background:${statusBg};border:1.5px solid ${statusBorder};border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:20px;">
        <div style="color:${statusColor};font-weight:800;font-size:18px;margin-bottom:4px;">${statusAR}</div>
        <div style="color:${statusColor};opacity:0.7;font-size:11px;letter-spacing:0.5px;">${statusEN}</div>
        ${!approved && data.reason ? `
          <div style="margin-top:12px;padding-top:12px;border-top:1px dashed ${statusBorder};">
            <div style="font-size:11px;color:#888;margin-bottom:4px;">سبب الرفض / Rejection Reason</div>
            <div style="color:#c62828;font-size:14px;font-weight:600;">${data.reason}</div>
          </div>` : ""}
      </div>

      <!-- بيانات الطلب -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-weight:bold;color:#555;font-size:12px;width:38%;">
            الفرع<br><span style="color:#aaa;font-size:10px;font-weight:400;">Branch</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;color:#2d2e32;font-weight:bold;">${data.branch||"—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-weight:bold;color:#555;font-size:12px;">
            الموظف<br><span style="color:#aaa;font-size:10px;font-weight:400;">Employee</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;color:#2d2e32;">${data.employeeName||"—"}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-weight:bold;color:#555;font-size:12px;">
            المورد<br><span style="color:#aaa;font-size:10px;font-weight:400;">Supplier</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;color:#2d2e32;">${data.supplierName||"—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:bold;color:#555;font-size:12px;">
            تاريخ الرد<br><span style="color:#aaa;font-size:10px;font-weight:400;">Response Date</span>
          </td>
          <td style="padding:10px 14px;color:#2d2e32;">${dateStr} — ${timeStr}</td>
        </tr>
      </table>

      <!-- المواد -->
      ${itemsSection}

      <!-- الملف المرفوع -->
      ${fileSection}

    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:13px;text-align:center;font-size:11px;color:#777;border-top:1px solid #eee;">
      نظام QB-Sentinel التابع لبرمجيات QB<br>
      <span style="font-size:10px;opacity:0.7;">QB-Sentinel System — Aseertime Operations</span>
    </div>
  </div>`;

  const subject = (approved ? "✓ اعتمد المورد طلب التوريد: " : "✗ رفض المورد طلب التوريد: ")
    + data.trackId + " — " + (data.supplierName||"") + " — " + dateStr;
  GmailApp.sendEmail(contacts.to, subject, "", {
    htmlBody, name: "نظام QB-Sentinel", cc: contacts.cc || ""
  });
}
