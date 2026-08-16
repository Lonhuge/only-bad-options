/************************************************************************
 * ONLY BAD OPTIONS — order log + email
 * Google Apps Script, bound to a Google Sheet.
 *
 * SETUP
 *  1. Create a Google Sheet (e.g. "OBO Bestellungen").
 *  2. Extensions → Apps Script. Delete the sample, paste THIS file.
 *  3. Set the two values below (NOTIFY_EMAIL, SECRET).
 *  4. Deploy → New deployment → type "Web app"
 *       Execute as: Me     Who has access: Anyone
 *     Copy the Web-app URL (ends with /exec).
 *  5. In Vercel add env vars:  SHEET_URL = that URL   ·   SHEET_SECRET = the SECRET below
 *     then Redeploy.
 ************************************************************************/

const NOTIFY_EMAIL = "deine@email.de";              // ← where order emails are sent
const SECRET       = "CHANGE_ME_zu_einem_zufallswort"; // ← must equal SHEET_SECRET in Vercel
const SHEET_NAME   = "Bestellungen";

const HEADERS = ["Ref","Datum","Status","Artikel","Menge","Zwischensumme","Versand","Gesamt (€)",
                 "Vorname","Nachname","E-Mail","Telefon","Straße","Zusatz","PLZ","Ort","Land","Bezahlt am"];

function doPost(e){
  try{
    const b = JSON.parse(e.postData.contents);
    if(b.token !== SECRET) return json({error:"unauthorized"});
    const sh = getSheet();
    if(b.action === "create") return handleCreate(sh, b);
    if(b.action === "paid")   return handlePaid(sh, b);
    return json({error:"unknown action"});
  }catch(err){ return json({error:String(err)}); }
}

function getSheet(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if(sh.getLastRow() === 0){
    sh.appendRow(HEADERS);
    sh.getRange(1,1,1,HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function itemsText(items){
  return (items||[]).map(function(i){
    return i.qty + "× " + (i.name||i.id) + (i.size ? " ("+i.size+")" : "");
  }).join("; ");
}

function handleCreate(sh, b){
  const c = b.customer || {};
  const menge = (b.items||[]).reduce(function(s,i){return s+(Number(i.qty)||0);},0);
  sh.appendRow([
    b.ref, new Date(), "pending", itemsText(b.items), menge,
    num(b.subtotal), num(b.shipping), num(b.total),
    c.firstName||"", c.lastName||"", c.email||"", c.phone||"",
    c.street||"", c.zusatz||"", c.plz||"", c.city||"", c.country||"", ""
  ]);
  return json({ok:true});
}

function handlePaid(sh, b){
  const data = sh.getDataRange().getValues();
  for(let r=1; r<data.length; r++){
    if(String(data[r][0]) === String(b.ref)){
      sh.getRange(r+1, 3).setValue("paid");        // Status
      sh.getRange(r+1, 18).setValue(new Date());   // Bezahlt am
      sendEmail(data[r]);
      return json({ok:true, updated:true});
    }
  }
  // fallback: no matching row (create call failed earlier) — still notify
  MailApp.sendEmail(NOTIFY_EMAIL, "🛒 Bezahlte Bestellung " + b.ref,
    "Bestellung " + b.ref + " wurde bezahlt (" + (b.total||"?") + " €).\nDetails im SumUp-Dashboard.");
  return json({ok:true, updated:false});
}

function sendEmail(row){
  const o = {
    ref:row[0], artikel:row[3], gesamt:row[7],
    name:(row[8]+" "+row[9]).trim(), email:row[10], phone:row[11],
    street:row[12], zusatz:row[13], plz:row[14], ort:row[15], land:row[16]
  };
  const addr = [o.name, o.street + (o.zusatz ? " / "+o.zusatz : ""), o.plz+" "+o.ort, o.land]
    .filter(function(x){return String(x).trim();}).join("\n");
  const body =
    "Neue bezahlte Bestellung 🎉\n\n" +
    "Bestell-Nr:  " + o.ref + "\n" +
    "Betrag:      " + o.gesamt + " €\n\n" +
    "── ARTIKEL ──\n" + o.artikel + "\n\n" +
    "── LIEFERADRESSE (DHL) ──\n" + addr + "\n\n" +
    "── KONTAKT ──\n" + o.email + (o.phone ? "  ·  " + o.phone : "") + "\n";
  MailApp.sendEmail(NOTIFY_EMAIL, "🛒 Bestellung " + o.ref + " — " + o.gesamt + " €", body);
}

function num(v){ const n = Number(v); return isFinite(n) ? n : 0; }
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
