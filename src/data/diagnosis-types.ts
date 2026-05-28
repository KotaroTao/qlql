export interface Question {
  id: number;
  text: string;
  imageUrl?: string | null;
  choices: {
    text: string;
    score: number;
  }[];
}

export interface ResultPattern {
  minScore: number;
  maxScore: number;
  category: string;
  title: string;
  message: string;
  ageModifier?: number; // お口年齢診断用
}

export interface DiagnosisType {
  slug: string;
  name: string;
  description: string;
  targetAge?: string;
  questions: Question[];
  resultPatterns: ResultPattern[];
}

export const oralAgeDiagnosis: DiagnosisType = {
  slug: "oral-age",
  name: "お口年齢診断",
  description: "簡単な質問に答えて、あなたのお口年齢をチェックしましょう",
  targetAge: "20歳以上",
  questions: [
    {
      id: 1,
      text: "1日の歯磨き回数は？",
      choices: [
        { text: "0回", score: 0 },
        { text: "1回", score: 5 },
        { text: "2回", score: 10 },
        { text: "3回以上", score: 10 },
      ],
    },
    {
      id: 2,
      text: "歯間ブラシやフロスを使っていますか？",
      choices: [
        { text: "使っていない", score: 0 },
        { text: "たまに", score: 5 },
        { text: "毎日", score: 10 },
      ],
    },
    {
      id: 3,
      text: "定期的に歯科検診を受けていますか？",
      choices: [
        { text: "受けていない", score: 0 },
        { text: "年1回程度", score: 5 },
        { text: "半年に1回以上", score: 10 },
      ],
    },
    {
      id: 4,
      text: "歯茎から出血することがありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 5,
      text: "口臭が気になることはありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 6,
      text: "冷たいものや熱いものがしみますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 7,
      text: "歯がグラグラする感じはありますか？",
      choices: [
        { text: "ある", score: 0 },
        { text: "少しある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "喫煙習慣はありますか？",
      choices: [
        { text: "吸う", score: 0 },
        { text: "以前吸っていた", score: 5 },
        { text: "吸わない", score: 10 },
      ],
    },
    {
      id: 9,
      text: "甘い飲み物やお菓子をよく摂りますか？",
      choices: [
        { text: "よく摂る", score: 0 },
        { text: "たまに", score: 5 },
        { text: "あまり摂らない", score: 10 },
      ],
    },
    {
      id: 10,
      text: "最後に歯科医院に行ったのはいつですか？",
      choices: [
        { text: "1年以上前", score: 0 },
        { text: "半年〜1年前", score: 5 },
        { text: "半年以内", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "要注意",
      title: "お口の健康に赤信号",
      message:
        "お口の健康に赤信号です。すぐに歯科医院での検診をおすすめします。",
      ageModifier: 15,
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "注意",
      title: "改善の余地あり",
      message:
        "お口のケアに改善の余地があります。定期検診を受けてみましょう。",
      ageModifier: 10,
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "やや注意",
      title: "まずまずのケア",
      message:
        "まずまずのケアができていますが、もう少し意識を高めましょう。",
      ageModifier: 5,
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "良好",
      title: "良いケアができています",
      message: "良いケアができています。この調子で続けましょう。",
      ageModifier: 0,
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優秀",
      title: "素晴らしいケア",
      message:
        "素晴らしいお口のケアです！定期検診で維持していきましょう。",
      ageModifier: -5,
    },
  ],
};

export const childOrthodonticsDiagnosis: DiagnosisType = {
  slug: "child-orthodontics",
  name: "子供の矯正タイミングチェック",
  description:
    "お子さんの歯並びや矯正のタイミングについてチェックしましょう",
  targetAge: "3〜12歳のお子さんをお持ちの保護者",
  questions: [
    {
      id: 1,
      text: "お子さんの年齢は？",
      choices: [
        { text: "3〜5歳", score: 0 },
        { text: "6〜8歳", score: 0 },
        { text: "9〜12歳", score: 0 },
      ],
    },
    {
      id: 2,
      text: "指しゃぶりや爪を噛む癖がありますか（ありましたか）？",
      choices: [
        { text: "現在もある", score: 10 },
        { text: "以前あった", score: 5 },
        { text: "ない", score: 0 },
      ],
    },
    {
      id: 3,
      text: "口呼吸をしていることが多いですか？",
      choices: [
        { text: "はい", score: 10 },
        { text: "時々", score: 5 },
        { text: "いいえ", score: 0 },
      ],
    },
    {
      id: 4,
      text: "乳歯の生え変わりは順調ですか？",
      choices: [
        { text: "遅い気がする", score: 5 },
        { text: "普通", score: 0 },
        { text: "早い気がする", score: 5 },
      ],
    },
    {
      id: 5,
      text: "歯並びで気になる点はありますか？",
      choices: [
        { text: "とても気になる", score: 10 },
        { text: "少し気になる", score: 5 },
        { text: "特にない", score: 0 },
      ],
    },
    {
      id: 6,
      text: "食べ物を噛むとき、片側だけで噛んでいませんか？",
      choices: [
        { text: "はい", score: 10 },
        { text: "時々", score: 5 },
        { text: "いいえ", score: 0 },
      ],
    },
    {
      id: 7,
      text: "発音で気になる点はありますか？",
      choices: [
        { text: "ある", score: 10 },
        { text: "少しある", score: 5 },
        { text: "ない", score: 0 },
      ],
    },
    {
      id: 8,
      text: "顔の左右で非対称な部分がありますか？",
      choices: [
        { text: "気になる", score: 10 },
        { text: "少し気になる", score: 5 },
        { text: "気にならない", score: 0 },
      ],
    },
    {
      id: 9,
      text: "ご家族に歯並びの悪い方はいますか？",
      choices: [
        { text: "いる", score: 10 },
        { text: "わからない", score: 5 },
        { text: "いない", score: 0 },
      ],
    },
    {
      id: 10,
      text: "以前、歯科医院で歯並びについて指摘を受けたことはありますか？",
      choices: [
        { text: "ある", score: 10 },
        { text: "覚えていない", score: 5 },
        { text: "ない", score: 0 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 20,
      category: "様子見",
      title: "今すぐの矯正は不要かもしれません",
      message:
        "現時点では大きな問題は見られません。ただし、成長とともに変化することがありますので、定期的なチェックをおすすめします。",
    },
    {
      minScore: 21,
      maxScore: 45,
      category: "相談推奨",
      title: "一度専門家に相談してみましょう",
      message:
        "いくつか気になるポイントがあります。矯正専門医への相談をおすすめします。早期発見が治療の選択肢を広げます。",
    },
    {
      minScore: 46,
      maxScore: 70,
      category: "早期相談",
      title: "早めの相談をおすすめします",
      message:
        "矯正治療の検討をおすすめする兆候が見られます。お子さんの成長段階に合わせた最適な治療タイミングを相談しましょう。",
    },
    {
      minScore: 71,
      maxScore: 100,
      category: "至急相談",
      title: "できるだけ早く専門医へ",
      message:
        "複数の気になる兆候があります。早期に矯正専門医の診察を受けることを強くおすすめします。",
    },
  ],
};

export const periodontalDiseaseDiagnosis: DiagnosisType = {
  slug: "periodontal-risk",
  name: "歯周病リスク診断",
  description:
    "簡単な質問に答えて、あなたの歯周病リスクをチェックしましょう",
  targetAge: "20歳以上",
  questions: [
    {
      id: 1,
      text: "歯磨きの時に歯茎から出血することがありますか？",
      choices: [
        { text: "毎回ある", score: 0 },
        { text: "よくある", score: 3 },
        { text: "たまにある", score: 7 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 2,
      text: "歯茎が赤く腫れていると感じることはありますか？",
      choices: [
        { text: "常に腫れている", score: 0 },
        { text: "よく腫れる", score: 3 },
        { text: "たまに腫れる", score: 7 },
        { text: "腫れていない", score: 10 },
      ],
    },
    {
      id: 3,
      text: "口臭が気になることはありますか？",
      choices: [
        { text: "いつも気になる", score: 0 },
        { text: "よく気になる", score: 3 },
        { text: "たまに気になる", score: 7 },
        { text: "ほとんど気にならない", score: 10 },
      ],
    },
    {
      id: 4,
      text: "歯と歯の間に食べ物が詰まりやすくなりましたか？",
      choices: [
        { text: "とても詰まりやすい", score: 0 },
        { text: "詰まりやすい", score: 3 },
        { text: "少し詰まる", score: 7 },
        { text: "詰まらない", score: 10 },
      ],
    },
    {
      id: 5,
      text: "歯が長くなった（歯茎が下がった）ように感じますか？",
      choices: [
        { text: "かなり長くなった", score: 0 },
        { text: "少し長くなった", score: 5 },
        { text: "変わらない", score: 10 },
      ],
    },
    {
      id: 6,
      text: "歯がグラグラ動くことがありますか？",
      choices: [
        { text: "複数の歯がグラグラする", score: 0 },
        { text: "1本だけグラグラする", score: 3 },
        { text: "少し動く気がする", score: 7 },
        { text: "動かない", score: 10 },
      ],
    },
    {
      id: 7,
      text: "硬いものを噛むと痛みや違和感がありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "喫煙習慣はありますか？",
      choices: [
        { text: "毎日吸う", score: 0 },
        { text: "たまに吸う", score: 3 },
        { text: "以前吸っていた", score: 7 },
        { text: "吸わない", score: 10 },
      ],
    },
    {
      id: 9,
      text: "糖尿病と診断されたことはありますか？",
      choices: [
        { text: "はい、治療中", score: 0 },
        { text: "予備軍と言われた", score: 5 },
        { text: "いいえ", score: 10 },
      ],
    },
    {
      id: 10,
      text: "定期的に歯科検診やクリーニングを受けていますか？",
      choices: [
        { text: "受けていない", score: 0 },
        { text: "1年に1回程度", score: 5 },
        { text: "半年に1回程度", score: 8 },
        { text: "3ヶ月に1回以上", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "高リスク",
      title: "歯周病の可能性が高いです",
      message:
        "歯周病の症状が複数見られます。できるだけ早く歯科医院を受診し、専門的な検査と治療を受けることを強くおすすめします。歯周病は放置すると歯を失う原因になります。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "中リスク",
      title: "歯周病の初期症状があるかもしれません",
      message:
        "いくつか気になる症状があります。早めに歯科医院でチェックを受けることをおすすめします。初期段階であれば、適切なケアで改善できる可能性があります。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "やや注意",
      title: "予防を心がけましょう",
      message:
        "現時点では大きな問題はなさそうですが、油断は禁物です。毎日の丁寧なブラッシングと定期検診で、歯周病を予防しましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "低リスク",
      title: "良い状態を維持しています",
      message:
        "歯茎の状態は良好です。今のケアを続けながら、定期的な歯科検診を受けて、健康な歯茎を維持しましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優良",
      title: "素晴らしい歯茎の健康状態です",
      message:
        "歯周病のリスクは非常に低いです。素晴らしいオーラルケアができています！この調子で継続してください。",
    },
  ],
};

export const cavityRiskDiagnosis: DiagnosisType = {
  slug: "cavity-risk",
  name: "虫歯リスク診断",
  description:
    "簡単な質問に答えて、あなたの虫歯リスクをチェックしましょう",
  targetAge: "全年齢",
  questions: [
    {
      id: 1,
      text: "1日に何回歯磨きをしますか？",
      choices: [
        { text: "0回または不定期", score: 0 },
        { text: "1回", score: 5 },
        { text: "2回", score: 8 },
        { text: "3回以上", score: 10 },
      ],
    },
    {
      id: 2,
      text: "甘い飲み物（ジュース、炭酸飲料、スポーツドリンクなど）をどのくらい飲みますか？",
      choices: [
        { text: "毎日複数回", score: 0 },
        { text: "毎日1回程度", score: 3 },
        { text: "週に数回", score: 7 },
        { text: "ほとんど飲まない", score: 10 },
      ],
    },
    {
      id: 3,
      text: "間食（おやつ）をどのくらいの頻度で摂りますか？",
      choices: [
        { text: "1日3回以上", score: 0 },
        { text: "1日2回程度", score: 3 },
        { text: "1日1回程度", score: 7 },
        { text: "ほとんど摂らない", score: 10 },
      ],
    },
    {
      id: 4,
      text: "フッ素入りの歯磨き粉を使用していますか？",
      choices: [
        { text: "使っていない", score: 0 },
        { text: "わからない", score: 5 },
        { text: "使っている", score: 10 },
      ],
    },
    {
      id: 5,
      text: "歯と歯の間のケア（フロス・歯間ブラシ）をしていますか？",
      choices: [
        { text: "していない", score: 0 },
        { text: "たまにする", score: 5 },
        { text: "毎日する", score: 10 },
      ],
    },
    {
      id: 6,
      text: "冷たいものや甘いものがしみることがありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 7,
      text: "過去1年間に虫歯の治療を受けましたか？",
      choices: [
        { text: "複数本治療した", score: 0 },
        { text: "1本治療した", score: 5 },
        { text: "治療していない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "定期的に歯科検診を受けていますか？",
      choices: [
        { text: "受けていない", score: 0 },
        { text: "1年に1回程度", score: 5 },
        { text: "半年に1回以上", score: 10 },
      ],
    },
    {
      id: 9,
      text: "口の中が乾きやすいと感じますか？",
      choices: [
        { text: "よく乾く", score: 0 },
        { text: "たまに乾く", score: 5 },
        { text: "乾かない", score: 10 },
      ],
    },
    {
      id: 10,
      text: "寝る前に歯磨きをしていますか？",
      choices: [
        { text: "しないことが多い", score: 0 },
        { text: "時々忘れる", score: 5 },
        { text: "毎日している", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "高リスク",
      title: "虫歯になりやすい状態です",
      message:
        "虫歯リスクが高い状態です。できるだけ早く歯科医院で検診を受け、虫歯がないかチェックしてもらいましょう。食生活や歯磨き習慣の改善も重要です。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "中リスク",
      title: "虫歯に注意が必要です",
      message:
        "いくつかリスク要因があります。定期的な歯科検診を受けながら、間食の回数を減らしたり、フッ素入り歯磨き粉を使うなど、予防を心がけましょう。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "やや注意",
      title: "予防を続けましょう",
      message:
        "比較的良い状態ですが、油断は禁物です。今のケアを続けながら、定期検診で虫歯の早期発見を心がけましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "低リスク",
      title: "良い習慣が身についています",
      message:
        "虫歯リスクは低めです。今の良い習慣を継続しながら、定期的な歯科検診で健康な歯を維持しましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優良",
      title: "素晴らしい虫歯予防ができています",
      message:
        "虫歯リスクは非常に低いです！素晴らしいオーラルケアと生活習慣が身についています。この調子で継続してください。",
    },
  ],
};

export const whiteningDiagnosis: DiagnosisType = {
  slug: "whitening-check",
  name: "ホワイトニング適正診断",
  description:
    "ホワイトニングがあなたに適しているかチェックしましょう",
  targetAge: "18歳以上",
  questions: [
    {
      id: 1,
      text: "歯の色で気になることはありますか？",
      choices: [
        { text: "全体的に黄ばんでいる", score: 10 },
        { text: "部分的に気になる", score: 7 },
        { text: "少し気になる程度", score: 5 },
        { text: "特に気にならない", score: 0 },
      ],
    },
    {
      id: 2,
      text: "コーヒー、紅茶、ワインなどをよく飲みますか？",
      choices: [
        { text: "毎日複数回飲む", score: 10 },
        { text: "毎日1回程度", score: 7 },
        { text: "週に数回程度", score: 3 },
        { text: "ほとんど飲まない", score: 0 },
      ],
    },
    {
      id: 3,
      text: "喫煙習慣はありますか？",
      choices: [
        { text: "現在吸っている", score: 10 },
        { text: "以前吸っていた", score: 5 },
        { text: "吸ったことがない", score: 0 },
      ],
    },
    {
      id: 4,
      text: "知覚過敏（冷たいものがしみる）の症状はありますか？",
      choices: [
        { text: "よくしみる", score: 0 },
        { text: "たまにしみる", score: 5 },
        { text: "ほとんどしみない", score: 10 },
      ],
    },
    {
      id: 5,
      text: "虫歯や歯周病の治療中ですか？",
      choices: [
        { text: "現在治療中", score: 0 },
        { text: "治療予定がある", score: 3 },
        { text: "特にない", score: 10 },
      ],
    },
    {
      id: 6,
      text: "前歯に詰め物や被せ物はありますか？",
      choices: [
        { text: "複数ある", score: 3 },
        { text: "1〜2本ある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 7,
      text: "妊娠中または授乳中ですか？",
      choices: [
        { text: "はい", score: 0 },
        { text: "いいえ", score: 10 },
      ],
    },
    {
      id: 8,
      text: "歯の変色の原因に心当たりはありますか？",
      choices: [
        { text: "加齢による変色", score: 10 },
        { text: "飲食物による着色", score: 10 },
        { text: "薬の副作用（テトラサイクリンなど）", score: 3 },
        { text: "わからない", score: 7 },
      ],
    },
    {
      id: 9,
      text: "結婚式や大切なイベントの予定はありますか？",
      choices: [
        { text: "1ヶ月以内にある", score: 10 },
        { text: "3ヶ月以内にある", score: 8 },
        { text: "半年以内にある", score: 5 },
        { text: "特にない", score: 3 },
      ],
    },
    {
      id: 10,
      text: "白い歯への関心度はどのくらいですか？",
      choices: [
        { text: "とても関心がある", score: 10 },
        { text: "まあまあ関心がある", score: 7 },
        { text: "少し関心がある", score: 3 },
        { text: "あまり関心がない", score: 0 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "要相談",
      title: "まずは歯科医師に相談しましょう",
      message:
        "現時点ではホワイトニングを行う前に、歯科医師への相談が必要です。虫歯や歯周病の治療、知覚過敏の対策など、まずはお口の健康を整えることをおすすめします。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "条件付き適正",
      title: "条件が整えばホワイトニング可能です",
      message:
        "いくつか確認が必要な点があります。歯科医院でカウンセリングを受けて、あなたに適したホワイトニング方法を相談してみましょう。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "適正あり",
      title: "ホワイトニングに適しています",
      message:
        "ホワイトニングを受けるのに良い条件が揃っています。オフィスホワイトニングとホームホワイトニング、どちらが合うか歯科医院で相談してみましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "高い適正",
      title: "ホワイトニングがおすすめです",
      message:
        "ホワイトニングに非常に適した状態です。効果も出やすいでしょう。ぜひ歯科医院でカウンセリングを受けて、理想の白さを手に入れましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "最適",
      title: "ホワイトニングで大きな効果が期待できます",
      message:
        "ホワイトニングの効果が最も期待できる状態です！白い歯への関心も高く、良い結果が得られるでしょう。お近くの歯科医院でカウンセリングを受けてみてください。",
    },
  ],
};

export const teethYellowingDiagnosis: DiagnosisType = {
  slug: "teeth-yellowing",
  name: "歯の黄ばみ診断",
  description:
    "毎日の習慣から歯の黄ばみリスクをチェックし、ホワイトニングのヒントを提案します",
  targetAge: "18歳以上",
  questions: [
    {
      id: 1,
      text: "コーヒー・紅茶・緑茶などをどのくらい飲みますか？",
      choices: [
        { text: "1日3杯以上", score: 0 },
        { text: "1日1〜2杯", score: 3 },
        { text: "週に数回", score: 7 },
        { text: "ほとんど飲まない", score: 10 },
      ],
    },
    {
      id: 2,
      text: "赤ワインやカレー、ミートソースなど色の濃い食事はよく摂りますか？",
      choices: [
        { text: "ほぼ毎日", score: 0 },
        { text: "週に数回", score: 3 },
        { text: "月に数回", score: 7 },
        { text: "ほとんど摂らない", score: 10 },
      ],
    },
    {
      id: 3,
      text: "喫煙習慣はありますか？",
      choices: [
        { text: "毎日吸う", score: 0 },
        { text: "たまに吸う", score: 3 },
        { text: "以前吸っていた", score: 6 },
        { text: "吸わない", score: 10 },
      ],
    },
    {
      id: 4,
      text: "色の濃い飲み物を飲んだあと、うがいや水を飲むことはありますか？",
      choices: [
        { text: "していない", score: 0 },
        { text: "気が向いたら", score: 5 },
        { text: "毎回している", score: 10 },
      ],
    },
    {
      id: 5,
      text: "ホワイトニング効果のある歯磨き粉を使っていますか？",
      choices: [
        { text: "使っていない", score: 0 },
        { text: "ときどき使う", score: 5 },
        { text: "毎日使っている", score: 10 },
      ],
    },
    {
      id: 6,
      text: "1日に何回歯磨きをしますか？",
      choices: [
        { text: "0〜1回", score: 0 },
        { text: "2回", score: 7 },
        { text: "3回以上", score: 10 },
      ],
    },
    {
      id: 7,
      text: "歯の表面がザラザラしている感じはありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "鏡で見て歯の色が黄ばんでいると感じますか？",
      choices: [
        { text: "全体的に黄ばんでいる", score: 0 },
        { text: "部分的に気になる", score: 4 },
        { text: "少し気になる程度", score: 7 },
        { text: "気にならない", score: 10 },
      ],
    },
    {
      id: 9,
      text: "歯科医院でクリーニング（PMTC）を受けたことはありますか？",
      choices: [
        { text: "受けたことがない", score: 0 },
        { text: "1年以上前に受けた", score: 5 },
        { text: "半年以内に受けた", score: 10 },
      ],
    },
    {
      id: 10,
      text: "ホワイトニングへの関心はどのくらいありますか？",
      choices: [
        { text: "とても気になっている", score: 0 },
        { text: "少し気になっている", score: 5 },
        { text: "現状で満足している", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "高リスク",
      title: "歯の黄ばみリスクがかなり高い状態です",
      message:
        "着色しやすい生活習慣が重なっています。歯科医院でのクリーニングやホワイトニングについて相談し、毎日のケアも見直しましょう。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "中リスク",
      title: "黄ばみが進みやすい状態です",
      message:
        "いくつか着色の原因になる習慣があります。色の濃い飲食物の後に水を飲む、ホワイトニング歯磨き粉を使うなどの工夫を始めてみましょう。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "やや注意",
      title: "予防を続けましょう",
      message:
        "比較的良い状態ですが油断は禁物です。定期的なクリーニングと丁寧なブラッシングで、白い歯をキープしましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "低リスク",
      title: "黄ばみにくい習慣ができています",
      message:
        "着色しにくい生活習慣が身についています。今のケアを続けながら、定期検診で歯の色味もチェックしてもらいましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優良",
      title: "白い歯を保てる理想的な状態です",
      message:
        "黄ばみリスクは非常に低い状態です。素晴らしいケアと習慣が身についています。この調子で継続しましょう。",
    },
  ],
};

export const visitTimingDiagnosis: DiagnosisType = {
  slug: "visit-timing",
  name: "受診タイミング診断",
  description:
    "今すぐ歯科医院に行くべきか、定期検診で十分かをチェックしましょう",
  targetAge: "全年齢",
  questions: [
    {
      id: 1,
      text: "最後に歯科医院に行ったのはいつですか？",
      choices: [
        { text: "2年以上前", score: 10 },
        { text: "1〜2年前", score: 7 },
        { text: "半年〜1年前", score: 4 },
        { text: "半年以内", score: 0 },
      ],
    },
    {
      id: 2,
      text: "今、歯や歯茎に痛みがありますか？",
      choices: [
        { text: "強い痛みがある", score: 10 },
        { text: "鈍い痛みやしみる感じがある", score: 7 },
        { text: "違和感がある程度", score: 4 },
        { text: "ない", score: 0 },
      ],
    },
    {
      id: 3,
      text: "歯茎の腫れや出血はありますか？",
      choices: [
        { text: "腫れて出血する", score: 10 },
        { text: "歯磨きの時に出血する", score: 6 },
        { text: "たまに出血する", score: 3 },
        { text: "ない", score: 0 },
      ],
    },
    {
      id: 4,
      text: "歯がグラグラしたり、噛むと違和感がありますか？",
      choices: [
        { text: "グラグラ動く歯がある", score: 10 },
        { text: "噛むと違和感がある", score: 6 },
        { text: "特にない", score: 0 },
      ],
    },
    {
      id: 5,
      text: "詰め物・被せ物が取れたり欠けたりしていますか？",
      choices: [
        { text: "取れている／欠けている", score: 10 },
        { text: "ぐらついている", score: 6 },
        { text: "問題ない", score: 0 },
      ],
    },
    {
      id: 6,
      text: "口臭が気になりますか？",
      choices: [
        { text: "強く気になる", score: 8 },
        { text: "たまに気になる", score: 4 },
        { text: "気にならない", score: 0 },
      ],
    },
    {
      id: 7,
      text: "冷たいもの・熱いものがしみますか？",
      choices: [
        { text: "強くしみる", score: 8 },
        { text: "たまにしみる", score: 4 },
        { text: "しみない", score: 0 },
      ],
    },
    {
      id: 8,
      text: "歯に黒い点や穴が見えますか？",
      choices: [
        { text: "見える／心当たりがある", score: 10 },
        { text: "よくわからない", score: 5 },
        { text: "見えない", score: 0 },
      ],
    },
    {
      id: 9,
      text: "前回の検診で「次回〇か月後に来てください」と言われた予定は守れていますか？",
      choices: [
        { text: "予定を過ぎている", score: 8 },
        { text: "もうすぐ予定の時期", score: 4 },
        { text: "予定どおり通えている／予定はない", score: 0 },
      ],
    },
    {
      id: 10,
      text: "近々、結婚式や面接など人前に出る予定はありますか？",
      choices: [
        { text: "1か月以内にある", score: 8 },
        { text: "3か月以内にある", score: 5 },
        { text: "特に予定はない", score: 0 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 20,
      category: "余裕あり",
      title: "今は急いで受診する必要はなさそうです",
      message:
        "目立った不調はないようです。ただし定期検診はトラブルの早期発見に有効ですので、半年に1回を目安にチェックを受けましょう。",
    },
    {
      minScore: 21,
      maxScore: 40,
      category: "そろそろ検診",
      title: "そろそろ定期検診の時期です",
      message:
        "少し気になるサインが見られます。1か月以内をめどに、定期検診とクリーニングの予約を取りましょう。",
    },
    {
      minScore: 41,
      maxScore: 65,
      category: "早めに受診",
      title: "早めに歯科医院に行きましょう",
      message:
        "症状が進行している可能性があります。2週間以内を目安に受診し、原因を確認してもらいましょう。放置すると治療が大がかりになる場合があります。",
    },
    {
      minScore: 66,
      maxScore: 85,
      category: "今週中に受診",
      title: "今週中の受診をおすすめします",
      message:
        "気になるサインが多く見られます。今週中に歯科医院に連絡し、できるだけ早い予約を取りましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "至急受診",
      title: "できる限り早く受診してください",
      message:
        "強い症状やトラブルのサインが複数あります。痛みや腫れが強い場合は、当日または翌日の受診をおすすめします。早めの対応が治療を軽くします。",
    },
  ],
};

export const badBreathRiskDiagnosis: DiagnosisType = {
  slug: "bad-breath-risk",
  name: "口臭リスク診断",
  description:
    "生活習慣やお口の状態から、口臭が発生しやすい状態かをチェックします",
  targetAge: "全年齢",
  questions: [
    {
      id: 1,
      text: "自分の口臭が気になることはありますか？",
      choices: [
        { text: "いつも気になる", score: 0 },
        { text: "よく気になる", score: 3 },
        { text: "たまに気になる", score: 7 },
        { text: "気にならない", score: 10 },
      ],
    },
    {
      id: 2,
      text: "周囲から口臭を指摘されたことはありますか？",
      choices: [
        { text: "何度かある", score: 0 },
        { text: "一度ある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 3,
      text: "舌の表面に白い苔（舌苔）がついていますか？",
      choices: [
        { text: "厚く白くついている", score: 0 },
        { text: "うっすらついている", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 4,
      text: "口の中が乾く感じはありますか？",
      choices: [
        { text: "いつも乾いている", score: 0 },
        { text: "たまに乾く", score: 5 },
        { text: "乾かない", score: 10 },
      ],
    },
    {
      id: 5,
      text: "歯磨きは1日に何回していますか？",
      choices: [
        { text: "0〜1回", score: 0 },
        { text: "2回", score: 7 },
        { text: "3回以上", score: 10 },
      ],
    },
    {
      id: 6,
      text: "フロスや歯間ブラシを使っていますか？",
      choices: [
        { text: "使っていない", score: 0 },
        { text: "たまに使う", score: 5 },
        { text: "毎日使っている", score: 10 },
      ],
    },
    {
      id: 7,
      text: "歯茎から出血したり、腫れたりすることはありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "鼻づまり・蓄膿症・後鼻漏などの症状はありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 9,
      text: "胃の不調（胃もたれ・逆流性食道炎など）はありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 10,
      text: "定期的に歯科でクリーニングを受けていますか？",
      choices: [
        { text: "受けていない", score: 0 },
        { text: "1年に1回程度", score: 5 },
        { text: "半年に1回以上", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "高リスク",
      title: "口臭リスクがかなり高い状態です",
      message:
        "口臭の原因となる要素が多く見られます。歯周病や舌苔、ドライマウスなどが関わっていることがあります。早めに歯科医院で原因をチェックしてもらいましょう。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "中リスク",
      title: "口臭が出やすい状態です",
      message:
        "気になるポイントがいくつかあります。フロスや舌のケアを取り入れ、こまめな水分補給で口の乾燥を防ぎましょう。歯科でのクリーニングもおすすめです。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "やや注意",
      title: "予防を続けましょう",
      message:
        "現時点では大きな問題はなさそうですが油断は禁物です。歯間ケアと定期検診で、口臭の原因を作らない口内環境をキープしましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "低リスク",
      title: "良い口内環境が保てています",
      message:
        "口臭リスクは低めです。今のケアを続けながら、定期的なクリーニングで安心できる息をキープしましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優良",
      title: "理想的なお口の状態です",
      message:
        "口臭リスクは非常に低い状態です。素晴らしいケアが習慣になっています。この調子で継続しましょう。",
    },
  ],
};

export const bruxismRiskDiagnosis: DiagnosisType = {
  slug: "bruxism-risk",
  name: "歯ぎしりリスク診断",
  description:
    "歯ぎしりや食いしばりの兆候があるかをチェックし、対策のヒントをお伝えします",
  targetAge: "全年齢",
  questions: [
    {
      id: 1,
      text: "家族やパートナーから「歯ぎしりの音がする」と言われたことはありますか？",
      choices: [
        { text: "よく言われる", score: 0 },
        { text: "言われたことがある", score: 5 },
        { text: "言われたことはない", score: 10 },
      ],
    },
    {
      id: 2,
      text: "朝起きたときに、あごが疲れていたりだるかったりしますか？",
      choices: [
        { text: "ほぼ毎朝感じる", score: 0 },
        { text: "週に数回ある", score: 3 },
        { text: "たまにある", score: 7 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 3,
      text: "あごの関節がカクッと鳴ったり、口が開きにくいことはありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 4,
      text: "頬の内側や舌のふちに、歯型のような跡がつくことはありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 5,
      text: "日中、気がつくと上下の歯を噛みしめていることがありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 6,
      text: "肩こり・頭痛・首のこりはありますか？",
      choices: [
        { text: "慢性的にある", score: 0 },
        { text: "ときどきある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 7,
      text: "歯がすり減っている、欠けたことがあると指摘されたことはありますか？",
      choices: [
        { text: "ある", score: 0 },
        { text: "わからない", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "知覚過敏（冷たいものがしみる）の症状はありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 9,
      text: "仕事や生活でストレスを感じていますか？",
      choices: [
        { text: "強く感じる", score: 0 },
        { text: "ときどき感じる", score: 5 },
        { text: "あまり感じない", score: 10 },
      ],
    },
    {
      id: 10,
      text: "睡眠の質はどうですか？（眠りが浅い・夜中に目が覚めるなど）",
      choices: [
        { text: "悪い", score: 0 },
        { text: "ふつう", score: 5 },
        { text: "よく眠れている", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "高リスク",
      title: "歯ぎしり・食いしばりの可能性が高い状態です",
      message:
        "歯や顎に大きな負担がかかっている可能性があります。歯のすり減りや破折、顎関節症の原因になることもあります。歯科医院でナイトガード（マウスピース）の作製を相談しましょう。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "中リスク",
      title: "歯ぎしりの兆候が見られます",
      message:
        "気になるサインがいくつかあります。日中の食いしばりに気づいたらリラックスする、就寝前にストレッチをするなどの工夫をしながら、歯科で一度チェックを受けましょう。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "やや注意",
      title: "予防を心がけましょう",
      message:
        "現時点で大きな問題はなさそうですが、ストレスや疲労がたまると歯ぎしりが出やすくなります。リラックスする時間を意識して取りましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "低リスク",
      title: "歯ぎしりリスクは低めです",
      message:
        "歯や顎にかかる負担は少ない状態です。今の生活リズムを大切にしながら、定期検診で歯のすり減りもチェックしてもらいましょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優良",
      title: "理想的な状態です",
      message:
        "歯ぎしり・食いしばりのリスクは非常に低い状態です。良い生活習慣が身についています。この調子で継続しましょう。",
    },
  ],
};

export const dentureRiskDiagnosis: DiagnosisType = {
  slug: "denture-risk",
  name: "入れ歯危険度診断",
  description:
    "将来、入れ歯（義歯）が必要になるリスクをチェックし、今からできる予防のヒントをお伝えします",
  targetAge: "40歳以上",
  questions: [
    {
      id: 1,
      text: "現在の年齢を教えてください",
      choices: [
        { text: "60代以上", score: 2 },
        { text: "50代", score: 5 },
        { text: "40代", score: 7 },
        { text: "30代以下", score: 10 },
      ],
    },
    {
      id: 2,
      text: "これまでに失った歯（親知らずを除く）の本数は？",
      choices: [
        { text: "6本以上", score: 0 },
        { text: "3〜5本", score: 4 },
        { text: "1〜2本", score: 7 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 3,
      text: "歯がグラグラする、噛むと痛い、歯ぐきから出血することはありますか？",
      choices: [
        { text: "よくある", score: 0 },
        { text: "たまにある", score: 5 },
        { text: "ほとんどない", score: 10 },
      ],
    },
    {
      id: 4,
      text: "硬いもの（おせんべい・たくあんなど）を噛みにくいと感じますか？",
      choices: [
        { text: "よく感じる", score: 0 },
        { text: "たまに感じる", score: 5 },
        { text: "感じない", score: 10 },
      ],
    },
    {
      id: 5,
      text: "1日の歯磨き・口腔ケアの習慣は？",
      choices: [
        { text: "0〜1回のみ", score: 0 },
        { text: "2回（歯ブラシのみ）", score: 5 },
        { text: "2回 + 歯間ブラシ/フロス", score: 8 },
        { text: "3回以上 + 歯間ケア", score: 10 },
      ],
    },
    {
      id: 6,
      text: "歯科検診の頻度はどれくらいですか？",
      choices: [
        { text: "ほとんど行かない", score: 0 },
        { text: "痛くなったときだけ", score: 3 },
        { text: "年1回程度", score: 7 },
        { text: "半年に1回以上", score: 10 },
      ],
    },
    {
      id: 7,
      text: "喫煙の習慣はありますか？",
      choices: [
        { text: "毎日吸う", score: 0 },
        { text: "ときどき吸う", score: 5 },
        { text: "やめた/吸わない", score: 10 },
      ],
    },
    {
      id: 8,
      text: "糖尿病、骨粗しょう症などの持病はありますか？",
      choices: [
        { text: "治療中の持病がある", score: 0 },
        { text: "予備軍と指摘されたことがある", score: 5 },
        { text: "特にない", score: 10 },
      ],
    },
    {
      id: 9,
      text: "むし歯や歯周病の治療を中断したまま、放置している歯はありますか？",
      choices: [
        { text: "ある", score: 0 },
        { text: "わからない", score: 5 },
        { text: "ない", score: 10 },
      ],
    },
    {
      id: 10,
      text: "ご家族（両親など）に入れ歯を使っている方はいますか？",
      choices: [
        { text: "50代以下から使い始めた", score: 0 },
        { text: "60代以降から使い始めた", score: 5 },
        { text: "いない/わからない", score: 10 },
      ],
    },
  ],
  resultPatterns: [
    {
      minScore: 0,
      maxScore: 30,
      category: "超高リスク",
      title: "入れ歯になる危険度が非常に高い状態です",
      message:
        "現状のままでは、将来入れ歯が必要になる可能性が高い状態です。歯周病や進行中のむし歯が隠れていることもあります。できるだけ早く歯科医院で総合的なチェックを受け、残っている歯を守る治療を始めましょう。",
    },
    {
      minScore: 31,
      maxScore: 50,
      category: "高リスク",
      title: "入れ歯リスクが高めです",
      message:
        "気になるサインが複数見られます。歯を失う原因の多くは歯周病とむし歯です。歯科でのクリーニングと治療計画の相談、毎日の歯間ケアを取り入れることで、これ以上歯を失うリスクを下げられます。",
    },
    {
      minScore: 51,
      maxScore: 70,
      category: "中リスク",
      title: "油断は禁物の状態です",
      message:
        "今のところ大きな問題はなさそうですが、生活習慣や加齢で一気にリスクが上がりやすい時期です。定期検診と歯間ブラシ・フロスの習慣を取り入れ、自分の歯を1本でも多く残しましょう。",
    },
    {
      minScore: 71,
      maxScore: 85,
      category: "低リスク",
      title: "入れ歯リスクは低めです",
      message:
        "歯と歯ぐきの状態は良好なようです。この調子で歯科検診とセルフケアを続ければ、将来も自分の歯で食事を楽しめる可能性が高いでしょう。",
    },
    {
      minScore: 86,
      maxScore: 100,
      category: "優良",
      title: "理想的なお口の状態です",
      message:
        "入れ歯になるリスクは非常に低い状態です。素晴らしいケアが習慣になっています。8020運動（80歳で20本以上の歯を残そう）の達成も十分に目指せます。この調子で継続しましょう。",
    },
  ],
};

export const diagnosisTypes: Record<string, DiagnosisType> = {
  "oral-age": oralAgeDiagnosis,
  "child-orthodontics": childOrthodonticsDiagnosis,
  "periodontal-risk": periodontalDiseaseDiagnosis,
  "cavity-risk": cavityRiskDiagnosis,
  "whitening-check": whiteningDiagnosis,
  "teeth-yellowing": teethYellowingDiagnosis,
  "visit-timing": visitTimingDiagnosis,
  "bad-breath-risk": badBreathRiskDiagnosis,
  "bruxism-risk": bruxismRiskDiagnosis,
  "denture-risk": dentureRiskDiagnosis,
};

export function getDiagnosisType(slug: string): DiagnosisType | undefined {
  return diagnosisTypes[slug];
}

export function calculateResult(
  diagnosis: DiagnosisType,
  answers: number[],
  userAge?: number
): {
  totalScore: number;
  resultPattern: ResultPattern;
  oralAge?: number;
} {
  const totalScore = answers.reduce((sum, score) => sum + score, 0);

  const resultPattern =
    diagnosis.resultPatterns.find(
      (p) => totalScore >= p.minScore && totalScore <= p.maxScore
    ) || diagnosis.resultPatterns[diagnosis.resultPatterns.length - 1];

  let oralAge: number | undefined;
  if (
    diagnosis.slug === "oral-age" &&
    userAge &&
    resultPattern.ageModifier !== undefined
  ) {
    oralAge = userAge + resultPattern.ageModifier;
  }

  return {
    totalScore,
    resultPattern,
    oralAge,
  };
}
