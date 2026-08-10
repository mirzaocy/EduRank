const QUESTION_BANK = {
    matematika: [
        { id: "m1", q: "Berapakah hasil dari integral tertentu ∫ (2x + 3) dx dengan batas bawah 1 dan batas atas 3?", options: ["12", "14", "16", "18"], answer: 1 },
        { id: "m2", q: "Turunan pertama dari f(x) = 3x^2 + 2x - 5 adalah...", options: ["6x + 2", "3x + 2", "6x - 2", "6x + 5"], answer: 0 },
        { id: "m3", q: "Nilai dari sin 30° + cos 60° adalah...", options: ["0", "0.5", "1", "2"], answer: 2 },
        { id: "m4", q: "Jika matriks A = [[2, 1], [3, 4]], maka determinan A adalah...", options: ["5", "6", "7", "8"], answer: 0 },
        { id: "m5", q: "Penyelesaian persamaan kuadrat x^2 - 5x + 6 = 0 adalah...", options: ["x=1 atau x=6", "x=2 atau x=3", "x=-2 atau x=-3", "x=2 atau x=-3"], answer: 1 }
    ],
    fisika: [
        { id: "f1", q: "Sebuah benda bermassa 2 kg bergerak dengan percepatan 3 m/s^2. Gaya yang bekerja adalah...", options: ["5 N", "6 N", "1.5 N", "2/3 N"], answer: 1 },
        { id: "f2", q: "Hukum II Newton menyatakan bahwa percepatan berbanding lurus dengan...", options: ["Massa", "Kecepatan", "Gaya Netto", "Waktu"], answer: 2 }
    ],
    bahasainggris: [
        { id: "b1", q: "The plural form of 'child' is...", options: ["childs", "childrens", "children", "childes"], answer: 2 },
        { id: "b2", q: "Identify the tense: 'I have been working here for 5 years.'", options: ["Present Perfect", "Present Perfect Continuous", "Past Continuous", "Past Perfect"], answer: 1 }
    ],
    informatika: [
        { id: "i1", q: "Kepanjangan dari CPU adalah...", options: ["Central Process Unit", "Computer Processing Unit", "Central Processing Unit", "Core Processing Unit"], answer: 2 },
        { id: "i2", q: "Bahasa pemrograman yang digunakan untuk membuat struktur halaman web adalah...", options: ["Python", "HTML", "Java", "C++"], answer: 1 }
    ]
};

function getRandomQuestions(subject, count) {
    let pool = [];

    if (!subject || subject === 'campuran' || !QUESTION_BANK[subject]) {
        pool = [
            ...QUESTION_BANK.matematika,
            ...QUESTION_BANK.fisika,
            ...QUESTION_BANK.bahasainggris,
            ...QUESTION_BANK.informatika,
        ];
    } else {
        pool = [...QUESTION_BANK[subject]];
    }

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, Math.max(1, Math.min(count, pool.length))).map((q) => ({
        id: q.id,
        q: q.q,
        options: q.options,
    }));
}
