// cierre_utils.js — Lógica compartida del cierre automático de caja.
// Se carga via require() desde cierre_auto.pb.js.

function runCierreAuto(app) {
    var cashClosingsCol = app.findCollectionByNameOrId("cashClosings");

    // Generic safe query: try with filter, fall back to all + JS post-filter
    function safeFilter(col, filter, postFilterFn) {
        var recs;
        try {
            recs = app.findRecordsByFilter(col, filter, "", 0, 0);
        } catch(_) {
            recs = app.findRecordsByFilter(col, "id != ''", "", 0, 0);
            if (postFilterFn) recs = recs.filter(postFilterFn);
        }
        return recs;
    }

    // Collect all unique companyIds from users
    var users = safeFilter("users", "companyId != ''", function(u) { return !!u.getString("companyId"); });
    var companiesArr = [""];  // "" covers single-tenant / no-company
    users.forEach(function(u) {
        var cid = u.getString("companyId");
        if (cid && companiesArr.indexOf(cid) === -1) companiesArr.push(cid);
    });

    // Venezuela "ayer": current UTC - 4 h, then - 1 day
    var now = new Date();
    var ayerVE = new Date(now.getTime() - (4 * 3600000) - (24 * 3600000));
    var ayerIso = ayerVE.toISOString().substring(0, 10);

    // Backfill window: max 30 days back
    var limite30 = new Date(ayerVE.getTime() - (30 * 24 * 3600000));
    var hace30Iso = limite30.toISOString().substring(0, 10);

    companiesArr.forEach(function(companyId) {
        var filter = companyId ? "companyId = '" + companyId + "'" : "companyId = ''";

        // Only process companies that already have at least one closure
        var closures = safeFilter("cashClosings", filter,
            companyId ? function(r) { return r.getString("companyId") === companyId; } : null
        );
        if (closures.length === 0) {
            console.log("[cierre_auto] empresa='" + companyId + "' → sin cierres previos, se omite.");
            return;
        }

        // Sort ascending for chained opening calculation
        closures.sort(function(a, b) {
            return a.getString("date") < b.getString("date") ? -1 : 1;
        });

        var closedDates = {};
        closures.forEach(function(c) { closedDates[c.getString("date")] = true; });

        // Fetch movements using safeFilter (handles missing companyId field in local dev DB)
        var postFn = companyId ? function(r) { return r.getString("companyId") === companyId; } : null;
        var salesRecs    = safeFilter("sales",              filter, postFn);
        var paymentsRecs = safeFilter("receivablePayments", filter, postFn);
        var expensesRecs = safeFilter("expenses",           filter, postFn);


        var datesSet = {};
        salesRecs.forEach(function(s)    { datesSet[s.getString("date")] = true; });
        paymentsRecs.forEach(function(p) { datesSet[p.getString("date")] = true; });
        expensesRecs.forEach(function(e) { datesSet[e.getString("date")] = true; });

        var sortedDates = Object.keys(datesSet).sort();
        var createdCount = 0;

        sortedDates.forEach(function(date) {
            if (date > ayerIso)    return;
            if (date < hace30Iso)  return;
            if (closedDates[date]) return;

            var sToday = salesRecs.filter(function(s)    { return s.getString("date") === date; });
            var pToday = paymentsRecs.filter(function(p) { return p.getString("date") === date; });
            var eToday = expensesRecs.filter(function(e) { return e.getString("date") === date; });

            if (sToday.length === 0 && pToday.length === 0 && eToday.length === 0) return;

            var ingresos = {}, egresos = {};

            sToday.forEach(function(s) {
                try {
                    var pays = JSON.parse(s.getString("payments") || "[]");
                    pays.forEach(function(p) {
                        if (p.method !== "Crédito") {
                            ingresos[p.method] = (ingresos[p.method] || 0) + (Number(p.amountUsd) || 0);
                        }
                    });
                } catch(err) {}
            });

            pToday.forEach(function(p) {
                var m = p.getString("method");
                if (m && m !== "Crédito") ingresos[m] = (ingresos[m] || 0) + p.getFloat("amount");
            });

            eToday.forEach(function(e) {
                var m = e.getString("method");
                if (m && m !== "Crédito") egresos[m] = (egresos[m] || 0) + e.getFloat("amountUsd");
            });

            // Find previous closure to chain opening
            var prevClosure = null;
            for (var i = closures.length - 1; i >= 0; i--) {
                if (closures[i].getString("date") < date) { prevClosure = closures[i]; break; }
            }

            var prevReal = {};
            if (prevClosure) {
                try { prevReal = JSON.parse(prevClosure.getString("real") || "{}"); } catch(err) {}
            }

            // Merge all method keys
            var methodsSet = {};
            Object.keys(ingresos).forEach(function(m) { methodsSet[m] = true; });
            Object.keys(egresos).forEach(function(m) { methodsSet[m] = true; });
            Object.keys(prevReal).forEach(function(m) { methodsSet[m] = true; });

            var opening = {}, teorico = {};
            Object.keys(methodsSet).forEach(function(m) {
                opening[m] = prevReal[m] || 0;
                teorico[m] = opening[m] + (ingresos[m] || 0) - (egresos[m] || 0);
            });

            // Create record — companyId is set explicitly
            var record = new Record(cashClosingsCol);
            record.set("date",      date);
            record.set("ts",        Date.now());
            record.set("companyId", companyId);
            record.set("opening",   JSON.stringify(opening));
            record.set("real",      JSON.stringify(teorico));
            record.set("diffUsd",   0);
            record.set("auto",      true);

            app.save(record);

            // Update in-memory state for chaining
            closures.push(record);
            closures.sort(function(a, b) {
                return a.getString("date") < b.getString("date") ? -1 : 1;
            });
            closedDates[date] = true;
            createdCount++;
        });

        console.log("[cierre_auto] empresa='" + companyId + "' → " + createdCount + " cierres creados.");
    });
}

module.exports = { runCierreAuto: runCierreAuto };
