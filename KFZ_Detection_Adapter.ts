// ===========================================================================================
// USER CONFIG:
// ===========================================================================================
const serverURL =                       "http://192.168.178.124:32168/v1/image/alpr"; // API-URL zum AI-Server
const imageURL =                        "http://192.168.178.90/snap.jpeg"; // Das Bild, welches erkannt werden soll
const minimumConfidencePercent =        75; // Mindesterkennungsrate des Bildes in Prozent
const minimumDetectionDurationTimeMS =  5000; // Mindest Detection-Intervall in ms

// ===========================================================================================
// DO NOT MODIFY CODE BELOW THIS LINE!
// ===========================================================================================
const baseDirectory = "/opt/iobroker/";
const baseState = "0_userdata.0.aiserver.Plate";
const fs = require('fs');
const Jimp = require('jimp') ;
var runningIndex = 0;

// Ergebnis der Detection als Json_Stringify (flachgeklopftes JSON)
const stateResult = baseState + ".result";
createState(stateResult, "", {
    name: stateResult,
    desc: stateResult,
    type: 'string', 
    read: true,
    write: true
});

// MinimumConfidence:
const stateMinimumConfidence = baseState + ".minimumConfidence";
createState(stateMinimumConfidence, minimumConfidencePercent, {
    name: stateMinimumConfidence,
    desc: stateMinimumConfidence,
    type: 'number', 
    read: true,
    write: true
});
setState(stateMinimumConfidence, minimumConfidencePercent);

start();
async function start() {
    let i = 0;
    do {
        i++;
        await doDetection(detectionResult);
    } while (true/* && i < 1*/);
}

async function doDetection(detectionResultCallback) {
    return new Promise(iterationCallback => {    
        var startTimeMs = new Date().getTime();

        // Bild laden, beispielsweise von der Kamera:
        request.get({url: imageURL,   
            encoding: null},  async function (err, response, body) {
            if (err) {
                throw err;
            }

            // Das geladene Bild auf der Festplatte abspeichern:            
            runningIndex++;
            if (runningIndex > 10) {
                runningIndex = 0;
            }
            var filename = baseDirectory + "detection_plate_" + runningIndex + ".jpg";
            fs.writeFile(filename, body, null, function(err) { 
                if (err) {
                    log("Error" + err);
                } else {

                    // Danach Bild wieder in den Speicher laden:
                    var image = fs.createReadStream(filename);
                    if (err) {
                        throw err;
                    } 

                    // KI-Übergabeparameter vorbereiten:                    
                    var options = {
                        method: 'POST',
                        url: serverURL,
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        },
                        formData: {
                            image: image,
                           // min_confidence: minimumConfidencePercent/100
                        }
                    };        

                    // KI API aufrufen mit unserem geladenen Bild:
                    request(options, function (error, response) {
                        if (error) throw new Error(error);
                        var json_object = JSON.parse(response.body);
                        json_object.filename_source = filename;

                        // Erfolg:                    
                        if (json_object.success) {    

                            Jimp.read(filename, function(err, imageJimp) { // Gets the image file from the URL
                                if (err) throw new Error(error);

                                Jimp.loadFont(Jimp.FONT_SANS_32_WHITE, function (err, fontJimp) {
                                    if (err) throw new Error(error);
                                    
                                    json_object.predictions.forEach(function (prediction) {
                                        if (prediction.confidence > (minimumConfidencePercent/100)) {

                                            // Prozentzahl als Text:
                                            imageJimp.scan(prediction.x_min, prediction.y_max+5, 75, 40, makeIteratorThatFillsWithColor(0x00000040));
                                            imageJimp.print(fontJimp, prediction.x_min+7, prediction.y_max+8, (prediction.confidence*100).toFixed(0)+"%");

                                            // border
                                            const fillCrimson = makeIteratorThatFillsWithColor(0xED143DFF);

                                            // Waagrecht; x1, y1, Länge Strich, Strichbreite (obere waagreche Linie):
                                            imageJimp.scan(prediction.x_min, prediction.y_min, (prediction.x_max-prediction.x_min), 3, fillCrimson); 

                                            // Waagrecht; x1, y1, Länge Strich, Strichbreite (untere waagreche Linie):
                                            imageJimp.scan(prediction.x_min, prediction.y_max, (prediction.x_max-prediction.x_min), 3, fillCrimson); 

                                            // Senkrecht; x1, y1, Strichbreite, Länge Strich (linke sekrechte Linie)
                                            imageJimp.scan(prediction.x_min, prediction.y_min, 3, (prediction.y_max-prediction.y_min), fillCrimson); 

                                            // Senkrecht; x1, y1, Strichbreite, Länge Strich (rechte sekrechte Linie)
                                            imageJimp.scan(prediction.x_max, prediction.y_min, 3, (prediction.y_max-prediction.y_min), fillCrimson); 
                                        }
                                    }); 

                                    var filenameBoundingBox = baseDirectory + "detection_plate_boundingbox" + runningIndex + ".jpg";
                                    json_object.filename_boundingbox = filenameBoundingBox;

                                    imageJimp.write(filenameBoundingBox, function(err) { 
                                        if (err) throw new Error(error);
                                
                                        // Callback-Aufruf. Dort kann man irgendwas mit dem Ergebnis machen:
                                        detectionResultCallback(JSON.stringify(json_object));

                                        // Nun gehen wir nicht gleich zur nächsten Iteration über, sondern warten/respektieren die Mindestdauer:                                    
                                        var endTimeMs = new Date().getTime();
                                        var waitDuration = minimumDetectionDurationTimeMS - (endTimeMs-startTimeMs);
                                        if (waitDuration > 0) {
                                            setTimeout(time => {
                                                iterationCallback("");
                                            }, waitDuration);   
                                        } else {
                                            iterationCallback("");
                                        }
                                    }); 
                                }); 
                            }); 
                        } else {
                            // Kein Erfolg:

                            // Callback-Aufruf. Dort kann man irgendwas mit dem Ergebnis machen:
                            detectionResultCallback(JSON.stringify(json_object));

                            // Nun gehen wir nicht gleich zur nächsten Iteration über, sondern warten/respektieren die Mindestdauer:                            
                            var endTimeMs = new Date().getTime();
                            var waitDuration = minimumDetectionDurationTimeMS - (endTimeMs-startTimeMs);
                            if (waitDuration > 0) {
                                setTimeout(time => {
                                    iterationCallback("");
                                }, waitDuration);   
                            } else {
                                iterationCallback("");
                            }
                        }
                    
                    }); // end request
                }
            }); // end write            
        });
    });    
}

function makeIteratorThatFillsWithColor(color) {
    return function (x, y, offset) {
        this.bitmap.data.writeUInt32BE(color, offset, true);
    }
};

function detectionResult(jsonObjectStringify) { // Parameter: Flachgeklopfte JSON-Struktur als String
    setState(stateResult, jsonObjectStringify);
}

