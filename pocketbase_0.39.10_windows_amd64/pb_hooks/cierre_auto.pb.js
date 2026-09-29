/// <reference path="../pb_data/types.d.ts" />

// Cron: every day at 04:00 UTC = 00:00 Venezuela (UTC-4, no DST)
cronAdd("cierre_auto", "0 4 * * *", function() {
    var utils = require(__hooks + "/cierre_utils.js");
    utils.runCierreAuto($app);
});

// Test endpoint: GET /api/cuadre/test-cron
// Triggered manually from PowerShell or Settings > Crons in the admin UI.
routerAdd("GET", "/api/cuadre/test-cron", function(e) {
    console.log("[test] test-cron triggered via HTTP");
    try {
        var utils = require(__hooks + "/cierre_utils.js");
        utils.runCierreAuto($app);
        return e.json(200, { status: "ok", msg: "cierre_auto ran successfully" });
    } catch(err) {
        return e.json(500, { status: "error", error: String(err) });
    }
});
