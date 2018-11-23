var express = require("express");
var alexa = require("alexa-app");
var Speech = require('ssml-builder');

var PORT = process.env.PORT || 8080;
var app = express();

var alexaApp = new alexa.app("test");

const debug = process.env.NODE_ENV !== 'production';
const checkCerts = process.env.NODE_ENV === 'production';

alexaApp.express({
  expressApp: app,
  checkCert: checkCerts,
  debug: debug
});

// now POST calls to /test in express will be handled by the app.request() function

// from here on you can setup any other express routes or middlewares as normal
// app.set("view engine", "pug");
// app.set('views', './src/views');

alexaApp.messages.NO_INTENT_FOUND = "Why you called dat intent? I don't know bout dat";

alexaApp.pre = (req, resp, type) => {
  console.log('Requesting ', req.type(), ' inside ', req.context, ' with the following data ', req.data)
};

alexaApp.launch(function(request, response) {
  console.log('Launched!');
    let speech = new Speech()
        .say('Guten Abend!')
        .pause('100ms')
        .say('Wonach suchst du heute?');

  response.say(speech.ssml(true));
  response.shouldEndSession(false);
});

alexaApp.intent("SearchIntent", {
    "slots": {
      "PRODUCT": "NAME"
    },
    "utterances": [
      "Ich suche ein {PRODUCT}",
      "Ich möchte ein {PRODUCT} finden.",
      "Gibt es ein {PRODUCT}"
    ]
  },
  function(request, response) {

    let test= {
      name: "Kleid",
      comp: "Apple"
    };
    //await search
    response.say("Ich habe " + test.name + " von " + test.comp + " gefunden");
    response.say("Willst du mehr Informationen zu dem Produkt?");
    response.say("Ich kann auch weitere Artikel suchen oder du kannst die suche mit Filtern eingrenzen, frag einfach nach verfügbaren Filtern");
    // Save relevant infos in session


  }
);

alexaApp.intent("FilterIntent", {
        "slots": {
            "PRODUCT": "NAME"
        },
        "utterances": [
            "Zeig mir vorhandene Filter"
        ]
    },
    function(request, response) {

        let test= {
            name: "Kleid",
            comp: "Apple"
        };
        //await search
        response.say("Für dein Produkt gibt es folgende Filter Wähl einfach einen davon aus");


    }
);


alexaApp.intent("AMAZON.StopIntent", function () {
  console.log('Stopped :(');
});

app.listen(PORT);
console.log("Listening on port " + PORT);
