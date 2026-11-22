// =============================================================
//  ローマ字入力はんてい（si / shi、tu / tsu などどちらでもOK）
// =============================================================
const Romaji = (() => {
  const T = {
    'あ':['a'],'い':['i','yi'],'う':['u','wu','whu'],'え':['e'],'お':['o'],
    'か':['ka','ca'],'き':['ki'],'く':['ku','cu','qu'],'け':['ke'],'こ':['ko','co'],
    'さ':['sa'],'し':['shi','si','ci'],'す':['su'],'せ':['se','ce'],'そ':['so'],
    'た':['ta'],'ち':['chi','ti'],'つ':['tsu','tu'],'て':['te'],'と':['to'],
    'な':['na'],'に':['ni'],'ぬ':['nu'],'ね':['ne'],'の':['no'],
    'は':['ha'],'ひ':['hi'],'ふ':['fu','hu'],'へ':['he'],'ほ':['ho'],
    'ま':['ma'],'み':['mi'],'む':['mu'],'め':['me'],'も':['mo'],
    'や':['ya'],'ゆ':['yu'],'よ':['yo'],
    'ら':['ra'],'り':['ri'],'る':['ru'],'れ':['re'],'ろ':['ro'],
    'わ':['wa'],'を':['wo'],
    'が':['ga'],'ぎ':['gi'],'ぐ':['gu'],'げ':['ge'],'ご':['go'],
    'ざ':['za'],'じ':['ji','zi'],'ず':['zu'],'ぜ':['ze'],'ぞ':['zo'],
    'だ':['da'],'ぢ':['di'],'づ':['du'],'で':['de'],'ど':['do'],
    'ば':['ba'],'び':['bi'],'ぶ':['bu'],'べ':['be'],'ぼ':['bo'],
    'ぱ':['pa'],'ぴ':['pi'],'ぷ':['pu'],'ぺ':['pe'],'ぽ':['po'],
    'ゔ':['vu'],
    'ぁ':['la','xa'],'ぃ':['li','xi'],'ぅ':['lu','xu'],'ぇ':['le','xe'],'ぉ':['lo','xo'],
    'ゃ':['lya','xya'],'ゅ':['lyu','xyu'],'ょ':['lyo','xyo'],'ゎ':['lwa','xwa'],
    'ー':['-'],
    'きゃ':['kya'],'きゅ':['kyu'],'きょ':['kyo'],'きぇ':['kye'],'きぃ':['kyi'],
    'しゃ':['sha','sya'],'しゅ':['shu','syu'],'しょ':['sho','syo'],'しぇ':['she','sye'],
    'ちゃ':['cha','tya','cya'],'ちゅ':['chu','tyu','cyu'],'ちょ':['cho','tyo','cyo'],'ちぇ':['che','tye','cye'],
    'にゃ':['nya'],'にゅ':['nyu'],'にょ':['nyo'],
    'ひゃ':['hya'],'ひゅ':['hyu'],'ひょ':['hyo'],
    'みゃ':['mya'],'みゅ':['myu'],'みょ':['myo'],
    'りゃ':['rya'],'りゅ':['ryu'],'りょ':['ryo'],
    'ぎゃ':['gya'],'ぎゅ':['gyu'],'ぎょ':['gyo'],
    'じゃ':['ja','zya','jya'],'じゅ':['ju','zyu','jyu'],'じょ':['jo','zyo','jyo'],'じぇ':['je','zye','jye'],
    'ぢゃ':['dya'],'ぢゅ':['dyu'],'ぢょ':['dyo'],
    'びゃ':['bya'],'びゅ':['byu'],'びょ':['byo'],
    'ぴゃ':['pya'],'ぴゅ':['pyu'],'ぴょ':['pyo'],
    'ふぁ':['fa'],'ふぃ':['fi'],'ふぇ':['fe'],'ふぉ':['fo'],'ふゅ':['fyu'],
    'てぃ':['thi'],'でぃ':['dhi'],'でゅ':['dhu'],'とぅ':['twu'],'どぅ':['dwu'],
    'うぃ':['wi'],'うぇ':['we'],'うぉ':['who'],
    'ゔぁ':['va'],'ゔぃ':['vi'],'ゔぇ':['ve'],'ゔぉ':['vo'],
    'つぁ':['tsa'],'いぇ':['ye'],
  };
  // 訓令式をおてほんにするときに先頭へ出すつづり
  const KUNREI = {
    'し':'si','ち':'ti','つ':'tu','ふ':'hu','じ':'zi',
    'しゃ':'sya','しゅ':'syu','しょ':'syo','ちゃ':'tya','ちゅ':'tyu','ちょ':'tyo',
    'じゃ':'zya','じゅ':'zyu','じょ':'zyo',
  };
  let style = 'hepburn';

  const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  function list(key) {
    const l = T[key];
    if (!l) return null;
    if (style === 'kunrei' && KUNREI[key]) return [KUNREI[key], ...l.filter(r => r !== KUNREI[key])];
    return l;
  }

  // 位置 i から入力できる候補 {len: かな文字数, r: ローマ字}
  function cands(k, i) {
    const out = [];
    const c = k[i];
    if (c === undefined) return out;
    if (c === 'ん') {
      out.push({ len: 1, r: 'nn' }, { len: 1, r: 'xn' }, { len: 1, r: "n'" });
      if (i + 1 < k.length) {
        const heads = cands(k, i + 1).map(x => x.r[0]);
        if (heads.every(h => !"aiueoyn'".includes(h))) out.push({ len: 1, r: 'n' });
      }
      return out;
    }
    if (c === 'っ') {
      if (i + 1 < k.length) {
        for (const x of cands(k, i + 1)) {
          const f = x.r[0];
          if (/[a-z]/.test(f) && !'aiueon'.includes(f)) {
            out.push({ len: 1 + x.len, r: f + x.r });
            if (x.r.startsWith('ch')) out.push({ len: 1 + x.len, r: 't' + x.r });
          }
        }
      }
      ['xtu', 'ltu', 'xtsu', 'ltsu'].forEach(r => out.push({ len: 1, r }));
      return out;
    }
    const two = k.substr(i, 2);
    const l2 = two.length === 2 ? list(two) : null;
    if (l2) l2.forEach(r => out.push({ len: 2, r }));
    const l1 = list(c);
    if (l1) l1.forEach(r => out.push({ len: 1, r }));
    if (!out.length) out.push({ len: 1, r: c }); // 想定外の文字はそのまま
    return out;
  }

  class Matcher {
    constructor(yomi) {
      this.k = toHira(yomi);
      this.i = 0;       // 何文字目（かな）まで確定したか
      this.buf = '';    // いまのかなに入力中のローマ字
      this.typed = '';  // 確定したローマ字
    }
    get done() { return this.i >= this.k.length; }
    get ratio() { return this.k.length ? this.i / this.k.length : 1; }
    commit(c) { this.typed += this.buf; this.i += c.len; this.buf = ''; }
    // 1文字入力。正しければ true
    input(ch) {
      if (this.done) return false;
      const cs = cands(this.k, this.i);
      const nb = this.buf + ch;
      if (cs.some(c => c.r.startsWith(nb))) {
        this.buf = nb;
        const exact = cs.find(c => c.r === nb);
        const longer = cs.some(c => c.r.length > nb.length && c.r.startsWith(nb));
        if (exact && !longer) this.commit(exact);
        return true;
      }
      // 「n」だけで ん を確定できる場合
      const ex = cs.find(c => c.r === this.buf);
      if (ex) {
        this.commit(ex);
        if (this.done) return false;
        return this.input(ch);
      }
      return false;
    }
    // おてほん表示用 {typed, rest}
    guide() {
      let rest = '';
      let i = this.i;
      if (i < this.k.length) {
        const cs = cands(this.k, i);
        const c = cs.find(x => x.r.startsWith(this.buf)) || cs[0];
        rest += c.r.slice(this.buf.length);
        i += c.len;
      }
      while (i < this.k.length) {
        const c = cands(this.k, i)[0];
        rest += c.r;
        i += c.len;
      }
      return { typed: this.typed + this.buf, rest };
    }
  }

  return {
    Matcher,
    toHira,
    setStyle(s) { style = s === 'kunrei' ? 'kunrei' : 'hepburn'; },
    getStyle() { return style; },
    sample(yomi) { return new Matcher(yomi).guide().rest; },
  };
})();
