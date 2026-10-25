  /* SIGHT-BEGIN */
  /* Sight reduction: apparent places of the Sun and the 58 navigational stars, Hs to Ho, Hc and Zn.
     Stars: Hipparcos (new reduction) J2000 position and proper motion, carried to the date with precession (IAU 1976),
     nutation (20 largest IAU 1980 terms) and annual aberration. Checked against ERFA/astropy to about 0.05 minute of arc.
     The Sun: VSOP87D Earth series (truncated), FK5 correction, nutation and aberration. Time scale: TT for the body (UTC + 69.184 s, valid while there are 37 leap seconds, 2017 on), UTC used as UT1 for the Earth's rotation (UT1 - UTC is below 0.9 s, so GHA can be off by up to 0.2 minute of arc, the same as the Nautical Almanac). Supported dates: 2000 to 2060. */
  var Sight = (function () {
    var R = Math.PI / 180, TTMUTC = 69.184;
    var CAT = [
      ["Alpheratz",2.09692,29.09043,137,-163],
      ["Ankaa",6.57105,-42.30599,233,-356],
      ["Schedar",10.12684,56.53733,51,-32],
      ["Diphda",10.89738,-17.98661,233,32],
      ["Achernar",24.42852,-57.23675,87,-38],
      ["Hamal",31.79336,23.46242,189,-148],
      ["Polaris",37.95456,89.26411,44,-12],
      ["Acamar",44.56531,-40.30468,-53,22],
      ["Menkar",45.56989,4.08974,-10,-77],
      ["Mirfak",51.08071,49.86118,24,-26],
      ["Aldebaran",68.98016,16.50930,63,-189],
      ["Rigel",78.63447,-8.20164,1,0],
      ["Capella",79.17233,45.99799,75,-427],
      ["Bellatrix",81.28276,6.34970,-8,-13],
      ["Elnath",81.57297,28.60745,23,-174],
      ["Alnilam",84.05339,-1.20192,1,-1],
      ["Betelgeuse",88.79294,7.40706,28,11],
      ["Canopus",95.98796,-52.69566,20,23],
      ["Sirius",101.28716,-16.71612,-546,-1223],
      ["Adhara",104.65645,-28.97209,3,1],
      ["Procyon",114.82550,5.22499,-715,-1037],
      ["Pollux",116.32896,28.02620,-627,-46],
      ["Avior",125.62848,-59.50948,-26,22],
      ["Suhail",136.99899,-43.43259,-24,14],
      ["Miaplacidus",138.29991,-69.71721,-156,109],
      ["Alphard",141.89684,-8.65860,-15,34],
      ["Regulus",152.09296,11.96721,-249,6],
      ["Dubhe",165.93196,61.75103,-134,-35],
      ["Denebola",177.26491,14.57206,-498,-115],
      ["Gienah",183.95155,-17.54193,-159,22],
      ["Acrux",186.64956,-63.09909,-36,-15],
      ["Gacrux",187.79150,-57.11321,28,-265],
      ["Alioth",193.50729,55.95982,112,-8],
      ["Spica",201.29825,-11.16132,-42,-31],
      ["Alkaid",206.88516,49.31327,-121,-15],
      ["Hadar",210.95586,-60.37304,-33,-23],
      ["Menkent",211.67061,-36.36995,-521,-518],
      ["Arcturus",213.91530,19.18241,-1093,-2000],
      ["Rigil Kentaurus",219.90206,-60.83399,-3679,474],
      ["Kochab",222.67636,74.15550,-33,11],
      ["Zubenelgenubi",222.71964,-16.04178,-106,-68],
      ["Alphecca",233.67195,26.71469,120,-90],
      ["Antares",247.35192,-26.43200,-12,-23],
      ["Atria",252.16623,-69.02771,18,-32],
      ["Sabik",257.59453,-15.72491,40,99],
      ["Shaula",263.40217,-37.10382,-9,-31],
      ["Rasalhague",263.73362,12.56004,108,-222],
      ["Eltanin",269.15154,51.48890,-8,-23],
      ["Kaus Australis",276.04299,-34.38462,-39,-124],
      ["Vega",279.23473,38.78369,201,286],
      ["Nunki",283.81636,-26.29672,15,-53],
      ["Altair",297.69583,8.86832,536,385],
      ["Peacock",306.41190,-56.73509,7,-86],
      ["Deneb",310.35798,45.28034,2,2],
      ["Enif",326.04648,9.87501,27,0],
      ["Al Na'ir",332.05827,-46.96097,127,-147],
      ["Fomalhaut",344.41269,-29.62224,329,-165],
      ["Markab",346.19022,15.20527,60,-41]
    ];
    var NUT = [[0,0,0,0,1,-171996,-174.2,92025,8.9],[-2,0,0,2,2,-13187,-1.6,5736,-3.1],[0,0,0,2,2,-2274,-0.2,977,-0.5],[0,0,0,0,2,2062,0.2,-895,0.5],[0,1,0,0,0,1426,-3.4,54,-0.1],[0,0,1,0,0,712,0.1,-7,0],[-2,1,0,2,2,-517,1.2,224,-0.6],[0,0,0,2,1,-386,-0.4,200,0],[0,0,1,2,2,-301,0,129,-0.1],[-2,-1,0,2,2,217,-0.5,-95,0.3],[-2,0,1,0,0,-158,0,0,0],[-2,0,0,2,1,129,0.1,-70,0],[0,0,-1,2,2,123,0,-53,0],[2,0,0,0,0,63,0,0,0],[0,0,1,0,1,63,0.1,-33,0],[2,0,-1,2,2,-59,0,26,0],[0,0,-1,0,1,-58,-0.1,32,0],[0,0,1,2,1,-51,0,27,0],[-2,0,2,0,0,48,0,0,0],[0,0,-2,2,1,46,0,-24,0]];
    /* Earth, VSOP87D (Bretagnon and Francou 1988), terms with amplitude 5e-7 or more: error under 0.7 arc-second over 2000-2060. [amplitude, phase, frequency], series by power of T (millennia TDB) */
    var VL = [[[1.753470457,0,0],[0.033416565,4.66926,6283.07585],[0.000348943,4.6261,12566.1517],[0.000034176,2.82887,3.52312],[0.000034971,2.74412,5753.38488],[0.000031359,3.62767,77713.77147],[0.000026762,4.41808,7860.41939],[0.000023427,6.13516,3930.2097],[0.000012732,2.0371,529.69097],[0.000013243,0.74246,11506.76977],[0.000009019,2.04505,26.29832],[0.000011992,1.10963,1577.34354],[0.000008572,3.50849,398.149],[0.000007798,1.17883,5223.69392],[0.000009903,5.23268,5884.92685],[0.000007531,2.53339,5507.55324],[0.000005053,4.58293,18849.22755],[0.000004924,4.20507,775.52261],[0.000003567,2.91954,0.06731],[0.000002841,1.89869,796.29801],[0.000002428,0.34481,5486.77784],[0.000003171,5.84902,11790.62909],[0.00000271,0.31489,10977.0788],[0.000002062,4.80647,2544.31442],[0.000002054,1.86948,5573.1428],[0.000002023,2.45768,6069.77675],[0.000001262,1.08303,20.7754],[0.000001555,0.83306,213.2991],[0.000001151,0.64545,0.98032],[0.000001029,0.636,4694.00295],[0.000001017,4.2668,7.11355],[9.92e-7,6.20993,2146.16542],[0.000001322,3.41118,2942.46342],[9.76e-7,0.68101,155.4204],[8.51e-7,1.29871,6275.9623],[7.47e-7,1.75509,5088.62884],[0.000001019,0.97569,15720.83878],[8.47e-7,3.6708,71430.69562],[7.35e-7,4.67927,801.82093],[7.39e-7,3.50319,3154.68708],[7.88e-7,3.03698,12036.46073],[7.96e-7,1.80791,17260.15465],[8.58e-7,5.98323,161000.68574],[5.7e-7,2.7843,6286.59897],[6.11e-7,1.8184,7084.89678],[6.96e-7,0.83298,9437.76293],[5.61e-7,4.38695,14143.49524],[6.24e-7,3.97764,8827.39027],[5.11e-7,0.28307,5856.47766],[5.56e-7,3.47006,6279.55273],[5.16e-7,1.33283,1748.01641],[5.2e-7,0.18915,12139.55351]],[[6283.319667475,0,0],[0.002060589,2.67823,6283.07585],[0.000043034,2.63513,12566.1517],[0.000004253,1.59047,3.52312],[0.00000109,2.96618,1577.34354],[9.35e-7,2.59213,18849.22755],[0.000001193,5.79557,26.29832],[7.21e-7,1.13846,529.69097],[6.78e-7,1.87472,398.149],[6.73e-7,4.40918,5507.55324],[5.9e-7,2.88797,5223.69392],[5.6e-7,2.17472,155.4204]],[[0.000529189,0,0],[0.000087198,1.0721,6283.07585],[0.000003091,0.86729,12566.1517]],[[0.000002892,5.84384,6283.07585]],[[0.000001141,3.14159,0]],[]],
        VB = [[[0.000002796,3.1987,84334.66158],[0.000001016,5.42249,5507.55324],[8.04e-7,3.88013,5223.69392]],[],[],[],[]],
        VR = [[[1.000139888,0,0],[0.016706996,3.09846,6283.07585],[0.00013956,3.05525,12566.1517],[0.000030837,5.19847,77713.77147],[0.000016285,1.17388,5753.38488],[0.000015756,2.84685,7860.41939],[0.000009248,5.45292,11506.76977],[0.000005424,4.56409,3930.2097],[0.000004721,3.661,5884.92685],[0.000003288,5.89984,5223.69392],[0.00000346,0.96369,5507.55324],[0.000003068,0.29867,5573.1428],[0.000001748,3.01194,18849.22755],[0.000002432,4.2735,11790.62909],[0.000002118,5.84715,1577.34354],[0.000001858,5.02194,10977.0788],[0.000001098,5.05511,5486.77784],[9.83e-7,0.88681,6069.77675],[8.65e-7,5.6896,15720.83878],[8.58e-7,1.27084,161000.68574],[6.29e-7,0.92177,529.69097],[5.71e-7,2.01374,83996.84732],[6.49e-7,0.27251,17260.15465],[5.57e-7,5.2416,71430.69562]],[[0.001030186,1.10749,6283.07585],[0.000017212,1.06442,12566.1517],[0.000007022,3.14159,0]],[[0.000043594,5.78455,6283.07585],[0.000001236,5.57935,12566.1517]],[[0.000001446,4.27319,6283.07585]],[],[]];
    /* visual magnitudes (to about 0.1), used only to prefer bright stars when suggesting a set */
    var MAG = { "Alpheratz": 2.06, "Ankaa": 2.39, "Schedar": 2.24, "Diphda": 2.04, "Achernar": 0.46, "Hamal": 2.0, "Polaris": 1.98, "Acamar": 2.9, "Menkar": 2.53, "Mirfak": 1.8, "Aldebaran": 0.85, "Rigel": 0.13, "Capella": 0.08, "Bellatrix": 1.64, "Elnath": 1.65, "Alnilam": 1.69, "Betelgeuse": 0.5, "Canopus": -0.74, "Sirius": -1.46, "Adhara": 1.5, "Procyon": 0.34, "Pollux": 1.14, "Avior": 1.86, "Suhail": 2.21, "Miaplacidus": 1.67, "Alphard": 1.98, "Regulus": 1.35, "Dubhe": 1.79, "Denebola": 2.14, "Gienah": 2.59, "Acrux": 0.76, "Gacrux": 1.63, "Alioth": 1.76, "Spica": 1.04, "Alkaid": 1.86, "Hadar": 0.61, "Menkent": 2.06, "Arcturus": -0.05, "Rigil Kentaurus": -0.01, "Kochab": 2.08, "Zubenelgenubi": 2.75, "Alphecca": 2.23, "Antares": 1.06, "Atria": 1.92, "Sabik": 2.43, "Shaula": 1.62, "Rasalhague": 2.07, "Eltanin": 2.23, "Kaus Australis": 1.85, "Vega": 0.03, "Nunki": 2.05, "Altair": 0.76, "Peacock": 1.94, "Deneb": 1.25, "Enif": 2.38, "Al Na'ir": 1.74, "Fomalhaut": 1.16, "Markab": 2.49 };
    function mod(a, n) { return ((a % n) + n) % n; }
    function jdOf(ms) { return ms / 86400000 + 2440587.5; }
    function nutation(T) {
      var D = mod(297.85036 + 445267.111480 * T - 0.0019142 * T * T, 360) * R, M = mod(357.52772 + 35999.050340 * T - 0.0001603 * T * T, 360) * R,
          Mp = mod(134.96298 + 477198.867398 * T + 0.0086972 * T * T, 360) * R, F = mod(93.27191 + 483202.017538 * T - 0.0036825 * T * T, 360) * R,
          Om = mod(125.04452 - 1934.136261 * T + 0.0020708 * T * T, 360) * R, dpsi = 0, deps = 0;
      for (var i = 0; i < NUT.length; i++) { var t = NUT[i], a = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F + t[4] * Om; dpsi += (t[5] + t[6] * T) * Math.sin(a); deps += (t[7] + t[8] * T) * Math.cos(a); }
      return { dpsi: dpsi * 0.0001 / 3600, deps: deps * 0.0001 / 3600 };               /* degrees */
    }
    function obliquity(T) { return 23.43929111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600; }
    function gast(jd, T, dpsi, eps) {                                                    /* Greenwich apparent sidereal time, degrees */
      var d = jd - 2451545, Tu = d / 36525;
      return mod(280.46061837 + 360.98564736629 * d + 0.000387933 * Tu * Tu - Tu * Tu * Tu / 38710000 + dpsi * Math.cos(eps * R), 360);
    }
    function frame(ms) {
      var jd = jdOf(ms), T = (jd + TTMUTC / 86400 - 2451545) / 36525, nu = nutation(T), eps0 = obliquity(T), eps = eps0 + nu.deps;
      return { jd: jd, T: T, dpsi: nu.dpsi, deps: nu.deps, eps: eps, eps0: eps0, gast: gast(jd, T, nu.dpsi, eps), yr: 2000 + (jd + TTMUTC / 86400 - 2451545) / 365.25 };
    }
    function sunApparent(ms, fr) {                                                      /* apparent GHA, Dec, SD and HP (minutes) of the Sun */
      var tau = (fr.jd + TTMUTC / 86400 - 2451545) / 365250;
      function ser(S) { var tot = 0; for (var k = 0; k < S.length; k++) { var s = 0, A = S[k]; for (var i = 0; i < A.length; i++) s += A[i][0] * Math.cos(A[i][1] + A[i][2] * tau); tot += s * Math.pow(tau, k); } return tot; }
      var Lh = ser(VL), Bh = ser(VB), Rau = ser(VR), Tc = fr.T;
      var th = mod(Lh / R * 1 + 180, 360), be = -Bh / R;                                 /* geocentric longitude and latitude, degrees (heliocentric + 180) */
      var lam1 = th - 1.397 * Tc - 0.00031 * Tc * Tc;                                    /* to the FK5 frame */
      th += (-0.09033 + 0) / 3600; be += 0.03916 * (Math.cos(lam1 * R) - Math.sin(lam1 * R)) / 3600;
      var lam = th + fr.dpsi - 20.4898 / Rau / 3600, eps = fr.eps * R, l = lam * R, b = be * R;
      var ra = mod(Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l)) / R, 360);
      var dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)) / R;
      return { name: "Sun", ra: ra, dec: dec, gha: mod(fr.gast - ra, 360), sd: 959.63 / Rau / 60, hp: 8.794 / Rau / 60, lon: mod(Lh / R + 180, 360), rau: Rau };
    }
    function starPlace(ms, name, fr) {
      var s = null; for (var i = 0; i < CAT.length; i++) if (CAT[i][0] === name) { s = CAT[i]; break; }
      if (!s) return null;
      fr = fr || frame(ms);
      var T = fr.T, dec0 = s[2] * R, dt = fr.yr - 2000;
      var ra0 = (s[1] + s[3] / Math.cos(dec0) * dt / 3.6e6) * R, de0 = (s[2] + s[4] * dt / 3.6e6) * R;
      /* precession J2000 to date (Meeus 21.2, rigorous) */
      var zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600 * R, z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600 * R, th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600 * R;
      var A = Math.cos(de0) * Math.sin(ra0 + zeta), B = Math.cos(th) * Math.cos(de0) * Math.cos(ra0 + zeta) - Math.sin(th) * Math.sin(de0), C = Math.sin(th) * Math.cos(de0) * Math.cos(ra0 + zeta) + Math.cos(th) * Math.sin(de0);
      var ra = Math.atan2(A, B) + z, de = Math.asin(C);
      /* annual aberration (Meeus 23.3), then nutation (23.1) */
      var sun = sunApparent(ms, fr), Ls = sun.lon * R, e = 0.016708634 - 0.000042037 * T, pi = (102.93735 + 1.71946 * T) * R, k = 20.49552 / 3600 * R, eps = fr.eps0 * R;
      var cd = Math.cos(de), sd = Math.sin(de), tane = Math.tan(eps);
      var dra = (-k * (Math.cos(ra) * Math.cos(Ls) * Math.cos(eps) + Math.sin(ra) * Math.sin(Ls)) + e * k * (Math.cos(ra) * Math.cos(pi) * Math.cos(eps) + Math.sin(ra) * Math.sin(pi))) / cd;
      var dde = -k * (Math.cos(Ls) * Math.cos(eps) * (tane * cd - Math.sin(ra) * sd) + Math.cos(ra) * sd * Math.sin(Ls)) + e * k * (Math.cos(pi) * Math.cos(eps) * (tane * cd - Math.sin(ra) * sd) + Math.cos(ra) * sd * Math.sin(pi));
      ra += dra; de += dde;
      var dpsi = fr.dpsi * R, deps = fr.deps * R, ee = fr.eps0 * R;
      var dran = (Math.cos(ee) + Math.sin(ee) * Math.sin(ra) * Math.tan(de)) * dpsi - Math.cos(ra) * Math.tan(de) * deps;
      var dden = Math.sin(ee) * Math.cos(ra) * dpsi + Math.sin(ra) * deps;
      ra += dran; de += dden;
      var raDeg = mod(ra / R, 360);
      return { name: name, ra: raDeg, sha: mod(360 - raDeg, 360), dec: de / R, gha: mod(fr.gast - raDeg, 360) };
    }
    function sunPlace(ms, fr) { var p = sunApparent(ms, fr || frame(ms)); return { name: "Sun", gha: p.gha, dec: p.dec, sd: p.sd, hp: p.hp, ra: p.ra }; }   /* sd and hp in minutes of arc */
    function reduce(lat, lon, gha, dec) {                                                /* Hc and Zn at (lat, lon east +) for a body at gha, dec; all degrees */
      var lha = mod(gha + lon, 360), l = lha * R, p = lat * R, d = dec * R;
      var hc = Math.asin(Math.max(-1, Math.min(1, Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(l)))) / R;
      var zn = mod(Math.atan2(-Math.sin(l) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(l)) / R, 360);
      return { hc: hc, zn: zn, lha: lha };
    }
    /* Hs to Ho. o = { hs (deg), ic (minutes to ADD: index correction, = -error on the arc, + error off the arc), hoe (m), temp (C), pres (hPa), body "sun"|"star", limb "L"|"U", sd, hp (minutes) } */
    function ho(o) {
      var t = o.temp === undefined ? 10 : o.temp, p = o.pres === undefined ? 1010 : o.pres;
      var dip = 1.76 * Math.sqrt(Math.max(0, o.hoe || 0));                                /* minutes */
      var ha = o.hs + ((o.ic || 0) - dip) / 60;                                           /* apparent altitude, degrees */
      var hh = Math.max(ha, -1);
      var ref = (1 / Math.tan((hh + 7.31 / (hh + 4.4)) * R)) * (p / 1010) * (283 / (273 + t));   /* Bennett, minutes */
      var sdc = 0, par = 0;
      if (o.body === "sun") { sdc = (o.limb === "U" ? -1 : 1) * (o.sd === undefined ? 16 : o.sd); par = (o.hp === undefined ? 0.15 : o.hp) * Math.cos(ha * R); }
      return { ha: ha, ho: ha + (-ref + sdc + par) / 60, dip: dip, ref: ref, sd: sdc, par: par, valid: ha > -0.5 };   /* below the horizon: refraction is not defined, valid is false */
    }
    function bodiesAt(ms, lat, lon) {
      var fr = frame(ms), out = [], s = sunPlace(ms), r = reduce(lat, lon, s.gha, s.dec); out.push({ name: "Sun", hc: r.hc, zn: r.zn });
      for (var i = 0; i < CAT.length; i++) { var sp = starPlace(ms, CAT[i][0], fr); r = reduce(lat, lon, sp.gha, sp.dec); out.push({ name: CAT[i][0], hc: r.hc, zn: r.zn }); }
      return out;
    }
    /* The best 3 or 4 stars to shoot: bright, between 20 and 70 degrees, azimuths spread round the horizon (largest smallest gap), nearest 45 degrees preferred. */
    function suggest(ms, lat, lon, count) {
      var want = count || 4, all = bodiesAt(ms, lat, lon).filter(function (b) { return b.name !== "Sun" && b.name !== "Polaris" && b.hc >= 20 && b.hc <= 70 && MAG[b.name] <= 2.3; });
      if (all.length <= want) return all.sort(function (a, b) { return a.zn - b.zn; });
      var best = null, bs = -1e9, idx = [];
      function score(set) {
        var z = set.map(function (s) { return s.zn; }).sort(function (a, b) { return a - b; }), gap = 360, i;
        for (i = 0; i < z.length; i++) { var g = (i + 1 < z.length ? z[i + 1] : z[0] + 360) - z[i]; if (g < gap) gap = g; }
        var alt = 0, mg = 0; set.forEach(function (s) { alt += Math.abs(s.hc - 45); mg += MAG[s.name]; });
        return gap - 0.15 * alt + 6 * (2.3 - mg / set.length);
      }
      (function rec(start, set) {
        if (set.length === want) { var sc = score(set); if (sc > bs) { bs = sc; best = set.slice(); } return; }
        for (var i = start; i < all.length; i++) { set.push(all[i]); rec(i + 1, set); set.pop(); }
      })(0, []);
      return best.sort(function (a, b) { return a.zn - b.zn; });
    }
    return { names: function () { return CAT.map(function (s) { return s[0]; }); }, frame: frame, starPlace: starPlace, sunPlace: sunPlace, reduce: reduce, ho: ho, bodiesAt: bodiesAt, suggest: suggest, mag: function (n) { return MAG[n]; } };
  })();
  /* SIGHT-END */
