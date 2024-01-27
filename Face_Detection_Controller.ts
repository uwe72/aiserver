const baseState = "0_userdata.0.aiserver.Face";

// Mindesterkennungsrate des Bildes in Prozent (Wird im Adapter-Script definiert):
const minimumConfidencePercent = getState(baseState + ".minimumConfidence").val;


var facesSearched = [];
for ( let i=2; i<=34; i++ ) {
    facesSearched.push(["Uwe_" + i, minimumConfidencePercent]);
}

// Wir reagieren auf ein neues Erkennungsergebnis:
on({id: baseState + ".result", change: 'any'},  obj => {    
    var value = obj.state.val;
    var oldValue = obj.oldState.val;
    if (value != oldValue) {
        if (value) {
            var jsonObject = JSON.parse(value);
            if (jsonObject.success) {
                jsonObject.predictions.forEach(faceDetected => {
                    facesSearched.forEach(faceSearched => {
                        if (faceDetected.userid == faceSearched[0] && faceDetected.confidence >= (faceSearched[1]/100)) {
                            send2Telegram(faceDetected.userid, (faceDetected.confidence*100).toFixed(0), jsonObject.filename_boundingbox);
                            send2Email(faceDetected.userid, (faceDetected.confidence*100).toFixed(0), jsonObject.filename_source);
                        }
                    });                       
                });                       
            }
        }
    }
});

// Versenden nach Telegramm:
var lasTimeTelegramSent = -1;
function send2Telegram(name, percent, picturePath) {
    var now = new Date().getTime();
    if ((now-lasTimeTelegramSent) > 1000*60) {

        // Haustüre:
        var lastTimeChangeMs = getState("0_userdata.0.homematic.haustuere_lastChange").val;
        var dif_seconds = (new Date().getTime() - lastTimeChangeMs) / 1000;


        if (getState("0_userdata.0.aiserver.Plate.ULEX4000").val) {
            sendTo('telegram.0', {text: picturePath, caption: "🤷‍♂️​ " + name + " (" + percent + "%), 🟢 UL-EX4000, 🚪 " + dif_seconds.toFixed(0) + "s"});
        } else {
            sendTo('telegram.0', {text: picturePath, caption: "🤷‍♂️​ " + name + " (" + percent + "%), 🔴 UL-EX4000, 🚪 " + dif_seconds.toFixed(0) + "s"});
        }
        lasTimeTelegramSent = now;
    }
}

// Versenden nach EMail:
var lasTimeEmailSent = -1;
function send2Email(name, percent, picturePath) {
    var now = new Date().getTime();
    if ((now-lasTimeEmailSent) > 1000*60) {
        if (getState("0_userdata.0.aiserver.Plate.ULEX4000").val) {        
            sendTo("email.0", {
                from:    "📊​ Smart Home [UCL] <uwe.clement@gmail.com>",                                                                                    
                to:      "uwe.clement@gmail.com", // comma separated multiple recipients.            
                subject: "🤷‍♂️​ " + name + " erkannt (" + percent + "%)",            
                html: "UL-EX4000 🟢<br><p><img src='cid:image1'/></p>",
                attachments:[
                    {path: picturePath, cid: "image1"}
                ]
            });
        } else {
            sendTo("email.0", {
                from:    "📊​ Smart Home [UCL] <uwe.clement@gmail.com>",                                                                                    
                to:      "uwe.clement@gmail.com", // comma separated multiple recipients.            
                subject: "🤷‍♂️​ " + name + " erkannt (" + percent + "%)",            
                html: "UL-EX4000 🔴​<br><p><img src='cid:image1'/></p>",
                attachments:[
                    {path: picturePath, cid: "image1"}
                ]
            });
        }
        lasTimeEmailSent = now;
    }
}
