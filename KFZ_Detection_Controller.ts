const baseState = "0_userdata.0.aiserver.Plate";

// Mindesterkennungsrate des Bildes in Prozent (Wird im Adapter-Script definiert):
const minimumConfidencePercent = getState(baseState + ".minimumConfidence").val;

// Kennzeichen Struktur:
interface Kennzeichen {
  id: string;
  varianten: string[];
}

const allSearchingKennzeichen = [];

// WN-EX4000:
let kennzeichen1: Kennzeichen = { id: "ULAX3000", varianten: ["ULAX3000", "UL AX"] };
allSearchingKennzeichen.push(kennzeichen1);

// Datenpunkte anlegen pro Kennzeichen_
allSearchingKennzeichen.forEach(singleKennzeichen => {

    // ID: z.B. WNEX4000 --> true/false
    createState(baseState + "." + singleKennzeichen.id, false, {
        name: singleKennzeichen.id,
        desc: singleKennzeichen.id,
        type: 'boolean', 
        read: true,
        write: true
    });   

    // Letzte mal auf true gesetzt: 
    createState(baseState + "." + singleKennzeichen.id + "_lastTimeTrueMs", 0, {
        name: singleKennzeichen.id,
        desc: singleKennzeichen.id,
        type: 'number', 
        read: true,
        write: true
    });   

    // Letzte Erkennungs-JSON: 
    createState(baseState + "." + singleKennzeichen.id + "_lastDetectionJsonStringify", "", {
        name: singleKennzeichen.id,
        desc: singleKennzeichen.id,
        type: 'string', 
        read: true,
        write: true
    });   

});                       

// Wir reagieren auf ein neues Erkennungsergebnis:
on({id: baseState + ".result", change: 'any'},  obj => {    
    var value = obj.state.val;
    var oldValue = obj.oldState.val;
    if (value != oldValue) {
        var jsonObject = JSON.parse(value);
        if (jsonObject.success) {

            // Wir iterieren über alle gefundenen/erkannten Kennzeichen:
            jsonObject.predictions.forEach(singleKennzeichen => {
                if (singleKennzeichen.confidence > (minimumConfidencePercent/100)) {
                    var found = false;

                    // Kennzeichen gefunden, welches der Mindesterkennungsrate entspricht:
                    var detectedKennzeichen = singleKennzeichen.label;
                    var confidence_percent = singleKennzeichen.confidence*100;

                    // Iterieren wir über alle Kennzeichen an denen wir Interesse haben:
                    allSearchingKennzeichen.forEach(searchKennzeichenStruktur => {
                        var varianten = searchKennzeichenStruktur.varianten;
                        varianten.forEach(variante => {
                            if (detectedKennzeichen.includes(variante)) {
                                found = true;
                                setState(baseState + "." + searchKennzeichenStruktur.id + "_lastTimeTrueMs", new Date().getTime());
                                setState(baseState + "." + searchKennzeichenStruktur.id + "_lastDetectionJsonStringify", value);
                                if (getState(baseState + "." + searchKennzeichenStruktur.id).val == false) {
                                    setTimeout(time => {
                                        setState(baseState + "." + searchKennzeichenStruktur.id, true);
                                    }, 100);   
                                }
                            }
                        });     

                    });                       
                    if (found == false) {
                        var picturePath = jsonObject.filename_boundingbox;
                        send2Telegram("⁉️ Missing plate: " + detectedKennzeichen, picturePath);
                        send2Email("⁉️ Missing plate: " + detectedKennzeichen, picturePath);
                    }
                }
            });                       
        }
    }
});

// Jede Minute schauen wir, ob es in den letzten 60 Sekunden wenigstens eine Erkennung gab pro Kennzeichen. Falls nicht, setzen wir den State auf false für das Kennzeichen:
setInterval(function() { 
    allSearchingKennzeichen.forEach(searchKennzeichenStruktur => {
        var lastTimeSetTrueMs = getState(baseState + "." + searchKennzeichenStruktur.id + "_lastTimeTrueMs").val;
        var difSeconds = (new Date().getTime() - lastTimeSetTrueMs) / 1000;
        if (difSeconds > 55) {
             setState(baseState + "." + searchKennzeichenStruktur.id, false);
        }
    });                       
}, 1000*60); 

// Event-Handling:
allSearchingKennzeichen.forEach(searchKennzeichenStruktur => {
    on({id: baseState + "." + searchKennzeichenStruktur.id, change: 'any'},  obj => {    
        var value = obj.state.val;
        var oldValue = obj.oldState.val;
        if (value != oldValue) {
            if (value) {
                var jsonStringify = getState(baseState + "." + searchKennzeichenStruktur.id + "_lastDetectionJsonStringify").val;
                var jsonObject = JSON.parse(jsonStringify);
                var picturePath = jsonObject.filename_boundingbox;

                send2Telegram("🚙 " + searchKennzeichenStruktur.id + " zu Hause", picturePath);
                send2Email("🚙 " + searchKennzeichenStruktur.id    + " zu Hause", picturePath);
            } else {
                send2Telegram("🚗​ " + searchKennzeichenStruktur.id + " abwesend", null);
                send2Email("🚗​ " + searchKennzeichenStruktur.id + " abwesend", null);
            }
        }
    });
});                       

// Versenden nach Telegramm:
function send2Telegram(txt, picturePath) {
    if (picturePath != null) {
        sendTo('telegram.0', {text: picturePath, caption: txt});
    } else {
        sendTo('telegram.0', txt);
    }
}

// Versenden nach EMail:
function send2Email(subject, picturePath) {
    if (picturePath != null) {
        sendTo("email.0", {
            from:    "📊​ Smart Home [UCL] <uwe.clement@gmail.com>",                                                                        
            to:      "uwe.clement@gmail.com", // comma separated multiple recipients.
            subject: subject,
            html: "<p><img src='cid:image1'/></p>",
            attachments:[
                {path: picturePath, cid: "image1"}
            ]
        });
    } else {
        sendTo("email.0", {
            from:    "📊​ Smart Home [UCL] <uwe.clement@gmail.com>",                                                                        
            to:      "uwe.clement@gmail.com", // comma separated multiple recipients.
            subject: subject,
            html: ""
        });
    }
}

