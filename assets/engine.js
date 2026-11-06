(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Multiplication = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'think-grow.multiplication.v1';
  const validNumber = value => Number.isInteger(value) && value >= 2 && value <= 9;
  const validRound = value => Number.isInteger(value) && value >= 0 && value < 5;
  const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
  const emptySave = () => ({ version: 1, results: {}, drafts: {}, active: null });

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  // За пять раундов каждый множитель 1–10 встретится не менее четырёх раз.
  function makeQuestions(number, round, random = Math.random) {
    if (!validNumber(number) || !validRound(round)) throw Error('Неверная локация или раунд');
    const multipliers = shuffle(Array.from({ length: 9 }, (_, index) => (round * 9 + index) % 10 + 1), random);
    return multipliers.map(multiplier => {
      const reversed = random() < 0.5;
      const product = number * multiplier;
      const options = shuffle([product, product + number, product > number ? product - number : product + number * 2], random);
      return { a: reversed ? multiplier : number, b: reversed ? number : multiplier, options, solved: false, rejected: [] };
    });
  }

  function normalizeSave(raw) {
    const data = emptySave();
    if (!raw || raw.version !== 1) return data;
    for (let number = 2; number <= 9; number++) {
      for (let round = 0; round < 5; round++) {
        const key = `${number}:${round}`;
        const result = raw.results?.[key];
        if (count(result?.mistakes)) data.results[key] = { mistakes: result.mistakes };
        if (raw.drafts?.[key]) {
          const draft = normalizeSave({ version: 1, active: raw.drafts[key] }).active;
          if (draft?.number === number && draft.round === round) data.drafts[key] = draft;
        }
      }
    }
    const active = raw.active;
    if (!active || !validNumber(active.number) || !validRound(active.round) || !count(active.mistakes) ||
        !Array.isArray(active.questions) || active.questions.length !== 9) return data;
    const multipliers = new Set();
    const validQuestions = active.questions.every(question => {
      if (!Number.isInteger(question.a) || !Number.isInteger(question.b) || question.a < 1 || question.a > 10 ||
          question.b < 1 || question.b > 10 || (question.a !== active.number && question.b !== active.number)) return false;
      const multiplier = question.a === active.number ? question.b : question.a;
      multipliers.add(multiplier);
      return Array.isArray(question.options) && question.options.length === 3 && new Set(question.options).size === 3 &&
        question.options.every(value => Number.isInteger(value) && value > 0 && value <= 120) &&
        question.options.includes(question.a * question.b) && typeof question.solved === 'boolean' &&
        Array.isArray(question.rejected) && question.rejected.length <= 2 && new Set(question.rejected).size === question.rejected.length &&
        question.rejected.every(value => question.options.includes(value) && value !== question.a * question.b);
    });
    if (!validQuestions || multipliers.size !== 9 || active.questions.every(question => question.solved)) return data;
    const rejected = active.questions.reduce((sum, question) => sum + question.rejected.length, 0);
    if (active.mistakes !== rejected) return data;
    const selected = active.selected;
    if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected >= 9 || active.questions[selected].solved)) return data;
    data.active = JSON.parse(JSON.stringify(active));
    return data;
  }

  class Game {
    constructor(storage, random = Math.random) {
      this.storage = storage;
      this.random = random;
      this.data = emptySave();
      this.persistent = false;
      try {
        this.data = normalizeSave(JSON.parse(storage.getItem(STORAGE_KEY)));
      } catch { /* Повреждённое сохранение не мешает новой игре. */ }
      try {
        storage.setItem(`${STORAGE_KEY}.check`, '1');
        storage.removeItem(`${STORAGE_KEY}.check`);
        this.persistent = true;
      } catch { /* Работаем в памяти, если хранилище недоступно. */ }
    }

    save() {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.persistent = true;
      } catch { this.persistent = false; }
    }

    start(number, round) {
      if (!validNumber(number) || !validRound(round)) throw Error('Неверная локация или раунд');
      if (this.data.active?.number === number && this.data.active.round === round) return this.data.active;
      if (this.data.active) this.data.drafts[`${this.data.active.number}:${this.data.active.round}`] = this.data.active;
      this.data.active = this.data.drafts[`${number}:${round}`] ??
        { number, round, questions: makeQuestions(number, round, this.random), selected: null, mistakes: 0 };
      this.save();
      return this.data.active;
    }

    select(index) {
      const active = this.data.active;
      if (!active || !Number.isInteger(index) || index < 0 || index > 8 || active.questions[index].solved) return false;
      active.selected = index;
      this.save();
      return true;
    }

    answer(value) {
      const active = this.data.active;
      if (!active || active.selected === null) return { accepted: false };
      const question = active.questions[active.selected];
      if (question.solved || !question.options.includes(value) || question.rejected.includes(value)) return { accepted: false };
      const correct = question.a * question.b === value;
      if (!correct) {
        question.rejected.push(value);
        active.mistakes++;
        this.save();
        return { accepted: true, correct: false };
      }
      question.solved = true;
      active.selected = null;
      const complete = active.questions.every(item => item.solved);
      if (!complete) {
        this.save();
        return { accepted: true, correct: true, complete: false };
      }
      const key = `${active.number}:${active.round}`;
      const previous = this.data.results[key];
      const first = !previous;
      const record = !previous || active.mistakes < previous.mistakes;
      if (record) this.data.results[key] = { mistakes: active.mistakes };
      delete this.data.drafts[key];
      const outcome = { accepted: true, correct: true, complete: true, number: active.number, round: active.round,
        mistakes: active.mistakes, first, record };
      this.data.active = null;
      this.save();
      return outcome;
    }

    reset() {
      const cleared = emptySave();
      if (this.storage) {
        try {
          // Перезаписываем только сохранение этой игры, не данные других игр.
          this.storage.setItem(STORAGE_KEY, JSON.stringify(cleared));
          this.persistent = true;
        } catch {
          return false;
        }
      }
      this.data = cleared;
      return true;
    }

    result(number, round) { return this.data.results[`${number}:${round}`] ?? null; }
    draft(number, round) {
      const active = this.data.active;
      return active?.number === number && active.round === round ? active : this.data.drafts[`${number}:${round}`] ?? null;
    }
    resumable() { return this.data.active ?? Object.values(this.data.drafts)[0] ?? null; }
    completed(number) { return [0, 1, 2, 3, 4].filter(round => this.result(number, round)).length; }
    total() { return Object.keys(this.data.results).length; }
    nextRound(number) { return [0, 1, 2, 3, 4].find(round => !this.result(number, round)) ?? 0; }
  }

  return { Game, makeQuestions, normalizeSave, shuffle, STORAGE_KEY,
    stars: mistakes => mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1 };
});
