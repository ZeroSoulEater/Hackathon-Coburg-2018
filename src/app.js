const path = require('path');
const fs = require('fs');

var express = require("express");
var alexa = require("alexa-app");
var Speech = require('ssml-builder');

var api = require('./empiriecom/api');
var utils = require('./empiriecom/utils');

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

alexaApp.messages.NO_INTENT_FOUND = "Ich weiß leider nicht was ich tun soll, versuch es doch noch einmal anders";

/*
alexaApp.pre = (req, resp, type) => {
    console.log('Requesting ', req.type(), ' inside ', req.context, ' with the following data ', req.data)
};
*/

alexaApp.launch(function (request, response) {
    console.log('Launched!');
    let session = request.getSession();
    session.set("status", "start");
    let speech = new Speech()
        .say('Guten Abend!')
        .pause('100ms')
        .say('Wonach suchst du heute?');

    response.say(speech.ssml(true)).reprompt('Ich war grade abgelenkt, kannst du das bitte nochmal sagen?');
    response.shouldEndSession(false);
});

var files = fs.readdirSync('dictionaries');
for (var file in files) {
    file = files[file];
    if (file === '.gitkeep') continue;
    const file_content = fs.readFileSync(path.join('dictionaries', file));
    const file_name = path.basename(file, '.csv');
    alexaApp.dictionary[file_name] = file_content.toString().trim().replace('\r', '').split('\n');
}

files = fs.readdirSync('slots');
for (var file in files) {
    file = files[file];
    if (file === '.gitkeep') continue;
    const file_content = fs.readFileSync(path.join('slots', file));
    const file_name = path.basename(file, '.csv');
    alexaApp.customSlot(file_name.toUpperCase(), alexaApp.dictionary[file_name] = file_content.toString().trim().replace('\r', '').split('\n'));
}

alexaApp.intent("SearchIntent", {
        "slots": {
            "PRODUCT": "AMAZON.SearchQuery",
            "CATEGORY": "CATEGORY",
            "BRAND": "BRAND",
            "COLOUR": "COLOUR",
        },
        "utterances": [
            "Ich suche {PRODUCT}",
            "Ich suche ein {PRODUCT}",
            "kannst du mir {PRODUCT} zeigen"
            /*
                  "Ich {verb} {quantity} {size|COLOUR|weight} {PRODUCT|CATEGORY}",
                  "Ich {verb} {quantity} {brand} {size|COLOUR|weight} {PRODUCT|CATEGORY}",
                  "Wir {verb} (attribute} {size|COLOUR|weight}  {PRODUCT|CATEGORY} von {BRAND}",
                  "Ich {verb} {quantity} {size|COLOUR|weight} {PRODUCT|CATEGORY} von {BRAND}",
                  "Wir {verb} {attribute} {size|COLOUR|weight} {PRODUCT|CATEGORY}",
                  "{verb} mir {quantity} {size|COLOUR|weight} {PRODUCT} von {BRAND}",
                  "{verb} uns {size|COLOUR|weight} {BRAND} {PRODUCT}",
                  "{verb} mir {PRODUCT|CATEGORY}",
                  "{verb} mir {BRAND} Produkte",
                  "{verb} uns {quantity} {size|COLOUR|weight} {BRAND} {PRODUCT}",
                  */
        ],
    },
    async function (request, response) {
        let session = request.getSession();
        /*
            {name, imageURL, url, description, brand}
         */
        let product = {};

        let filter = {};

        /*
        if (request.slots["COLOUR"]) {
            //TODO: get filter id fpr color
            filter = {filters: {filter_color: ['f135']}}
        }
        */
        await api.getTopProduct({query: request.slots["PRODUCT"].value, filters: filter}).then(p => {
            console.log(p);
            product = p;
        }).catch(e => {
            console.log(e.error);
            return response.clear().say("Ein Fehler, es tut mir leid :(").send();
        });

        console.log("test response", product);
        //await search
        response.say("Ich habe " + product.name + " von " + product.brand + " gefunden es kostet " + product.price);
        response.say("Willst du mehr Informationen zu dem Produkt?");
        response.say("Ich kann auch weitere Artikel suchen oder du kannst die Suche mit Filtern eingrenzen, frag einfach nach verfügbaren Filtern");

        // Save relevant infos in session
        session.set("product", JSON.stringify(product));
        session.set("status", "search");
        session.set("query", request.slots["PRODUCT"].value);

        response.shouldEndSession(false);

    }
);

alexaApp.intent("FilterIntent", {
        "slots": {},
        "utterances": [
            "Zeig mir verfügbare filter",
            "Lass mich weitere Filter auswählen",
            "Ich möchte Filtern"
        ]
    },
    async function (request, response) {
        let session = request.getSession();
        let filters = {};
        let filterString = '';
        response.shouldEndSession(false);
        await api.getFilters(session.get("query")).then(f => {
            filters = f;
            console.log(filters);
        }).catch(e => {
            console.log(e.error);
            return response.clear().say("Ein Fehler, es tut mir leid :(").send();
        });

        for (let key in filters) {
            if (filters.hasOwnProperty(key)) {
                if(filterString === '')
                    filterString += filters[key];
                else
                    filterString += '. ' + filters[key];
            }
        }

        session.set("filter_names", JSON.stringify(filters));
        response.say("Für dein Produkt gibt es folgende Filter wähle einfach einen davon aus. " + filterString);
        response.shouldEndSession(false);

    }
);


alexaApp.intent("SelectFilterIntent", {
        "slots": {"FILTER_NAME": "FILTER_NAME"},
        "utterances": [
            "{}"
        ]
    },
    async function (request, response) {
        let session = request.getSession();
        let filterOptions = {};
        let filterOptionString = '';

        let filter_name = request.slots["FILTER_NAME"].value === 'farbe' ? 'filter_color' : request.slots["FILTER_NAME"].value

        response.shouldEndSession(false);
        //console.log('FN:', filter_name);
        await api.getFilterOptions(session.get("query"), filter_name).then((fo) => {
            //console.log('FO:', fo);
            filterOptions = fo;
        }).catch(e => {
            console.log(e.error);
            return response.clear().say("Ein Fehler ist aufgetreten, es tut mir leid.").send();
        });

        //console.log(filterOptions);
        for (let key in filterOptions) {
          //console.log(key);
            if (filterOptions.hasOwnProperty(key)) {
                //console.log(filterOptionString);
                if(filterOptionString === '')
                    filterOptionString += filterOptions[key];
                else
                    filterOptionString += '. ' + filterOptions[key];
            }
        }


        console.log("SELECT FILTER INTENT", request.slots["FILTER_NAME"].value);
        console.log("FILTER OPTION", filterOptionString);
        session.set("filter_name", request.slots["FILTER_NAME"].value);
        response.say("Für deinen Filter gibt es folgende optionen, wähle bitte eine aus. " + filterOptionString);

    }
);


alexaApp.intent("SetFilterIntent", {
        "slots": {"VALUE": "VALUE"},
        "utterances": [
            "{}"
        ]
    },
    async function (request, response) {
        let session = request.getSession();
        response.shouldEndSession(false);

        let filterObject = {};
        let product = {};

        await utils.mapFilterToCode(session.get("filter_name"), request.slots["VALUE"].value)
            .then(async a => {
                await utils.buildFilterObject(a)
                    .then(b => {
                        filterObject = b;
                    })
            });

        console.log("here should be a filter object: " + filterObject);

        await api.getTopProduct({query: session.get("query"), filters: filterObject}).then(p => {
            console.log(p);
            product = p;
        }).catch(e => {
            console.log(e.error);
            return response.clear().say("Ein Fehler, es tut mir leid :(").send();
        });

        //await search
        response.say("Ich habe " + product.name + " von " + product.brand + " gefunden es kostet " + product.price);
        response.say("Willst du mehr Informationen zu dem Produkt?");
        response.say("Ich kann auch weitere Artikel suchen oder du kannst die Suche mit Filtern eingrenzen, frag einfach nach verfügbaren Filtern");

        // Save relevant infos in session
        session.set("product", JSON.stringify(product));
        session.set("status", "search");
        session.set("query", request.slots["PRODUCT"].value);

        console.log("SELECT SET FILTER INTENT", request.slots["VALUE"].value);

    }
);

alexaApp.intent("DetailIntent", {
        "slots": {},
        "utterances": [
            "Zeig mir mehr Infos",
            "Zeig mir mehr Informationen"
        ]
    },
    async function (request, response) {
        response.shouldEndSession(false);
        let session = request.getSession();

        if (session.get("status") !== "search" | session.get("product") === undefined) {
            return response.say("Du musst dir erst ein Produkt aussuchen um Details dazu zu sehen. Sag zum Beispiel. Ich suche ein Kleid").send()
        }

        let product = JSON.parse(session.get("product"));
        response.say(`Ich lese dir eine kurze beschreibung zu deinem Produkt ${product.name} vor`);
        response.say(`${product.description}`);
        response.say("Möchtest du dir dieses Produkt Merken?");
        session.set("status", "detail");

    }
);

alexaApp.intent("AMAZON.YesIntent", {
        "slots": {},
        "utterances": []
    }, function (request, response) {
        response.shouldEndSession(true);
        let session = request.getSession();


        if (session.get("status") !== "detail") {
            response.shouldEndSession(false);
            return response.say("Ja, was?").send();
        }

        let product = JSON.parse(session.get("product"));
        console.log("FUCKING SHIT CARD", product);
        response.card({
            type: "Standard",
            title: "Mac:Rush hat für dich gefunden!",
            text: `Du hast grade ein ${product.name} von ${product.brand} gefunden klicke auf den folgenden Link um es dir nochmal anzuschauen\n ${product.url} \n Preis: ${product.price}`,
            image: { // image is optional
                smallImageUrl: product.imageURL, // required
                largeImageUrl: product.imageURL
            }
        });
        response.say("Schau einfach in deine Alexa App, dort findest du das Produkt, bis zum nächsten mal");
    }
);

alexaApp.intent("AMAZON.NoIntent", {
        "slots": {},
        "utterances": []
    }, function (request, response) {
        response.shouldEndSession(true);
        response.say("Ok, dann bis später, ich freue mich auf dich!");
    }
);

alexaApp.intent("AMAZON.StopIntent", {
        "slots": {},
        "utterances": ["Ich mag nicht mehr"]
    }, function (request, response) {
        console.log('Stopped :(');
        response.say("Tschüß, wenn du wieder etwas suchst frag mich einfach!");
    }
);

alexaApp.intent("AMAZON.HelpIntent", {
        "slots": {},
        "utterances": ["Was muss ich tun", "Hilfe was habe ich gerade gemacht", "Was"]
    }, function (request, response) {
        console.log('Some needs your help');
        let session = request.getSession();

        let status = session.get("status");
        response.shouldEndSession(false);

        switch (status) {
            case "search":
                let product = JSON.parse(session.get("product"));
                response.say("Ich habe gerade" + product.name + " von " + product.brand + " für dich gefunden gefunden");
                response.say("Du kannst entweder mehr Informationen zu dem Produkt haben oder");
                response.say("Ich kann auch ähnlichen Artikel geben oder du kannst die suche mit Filtern eingrenzen, frag einfach nach verfügbaren Filtern");

                return response.say("").send();
                break;

            case "start":
                return response.say("Du wolltest mir grade sagen nach welchem Produkt ich suchen soll").send();
                break;
            case "detail":
                return response.say("Ich habe gefragt, ob du dir das Produkt merken willst").send();
                break;
            default:
                let speech = new Speech()
                    .say('Ich weiß auch gerade auch nicht')
                    .pause('300ms')
                    .say('sorry, sag doch einfach irgendwas?');
                return response.say(speech.ssml(true));

        }
    }
);


if (process.env.NODE_ENV !== 'production') {
    fs.writeFile('schema.json', alexaApp.schemas.askcli('bauer shopping'), (err) => {
        if (err) throw err;
        console.log('Wrote schema.json');
    });
}

app.listen(PORT);
console.log("Listening on port " + PORT);
