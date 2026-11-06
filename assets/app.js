'use strict';

const byId = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const game = new Multiplication.Game(storage);
const view = { screen: 'map', number: 2, round: 0, collectionNumber: 2, rewardFromCollection: false };

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function actionButton(text, action, className, data = {}) {
  const element = node('button', className, text);
  element.type = 'button';
  element.dataset.action = action;
  Object.assign(element.dataset, data);
  return element;
}

function locationData(number = view.number) { return GAME_LOCATIONS.find(item => item.number === number); }
function rewardData(number = view.number, round = view.round) { return locationData(number).rewards[round]; }
function previewImage(number) { return `assets/previews/${number}.svg`; }
function starText(mistakes) { const stars = Multiplication.stars(mistakes); return '★'.repeat(stars) + '☆'.repeat(3 - stars); }

function updateStatus() {
  byId('totalCount').textContent = `${game.total()} / 40`;
  byId('saveStatus').textContent = game.persistent
    ? 'Прогресс сохраняется в этом браузере · без регистрации'
    : 'Сохранение недоступно: прогресс останется до обновления страницы';
  byId('resetProgress').disabled = game.total() === 0 && !game.resumable();
}

function showScreen(name) {
  view.screen = name;
  byId('resetProgress').hidden = name !== 'map';
  byId('footerMotto').hidden = name === 'map';
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== `${name}Screen`;
  document.documentElement.style.setProperty('--accent', name === 'map' ? '#7957a0' : locationData(name === 'collection' ? view.collectionNumber : view.number).color);
  updateStatus();
  const title = byId(`${name}Title`);
  title?.focus({ preventScroll: true });
}

function renderMap() {
  const grid = byId('locationGrid');
  grid.replaceChildren();
  for (const location of GAME_LOCATIONS) {
    const completed = game.completed(location.number);
    const card = actionButton('', 'chooseLocation', 'location-card', { number: location.number });
    card.style.setProperty('--card-color', location.color);
    card.setAttribute('aria-label', `Таблица умножения на ${location.number}. ${location.title}. Пройдено ${completed} из 5 раундов.`);
    const image = node('img'); image.src = previewImage(location.number); image.alt = ''; image.decoding = 'async';
    const top = node('span', 'location-card-top');
    top.append(node('span', 'table-number', `×${location.number}`), node('span', 'location-card-progress', completed === 5 ? '✓ Пройдено' : `${completed} / 5 открытий`));
    const copy = node('span', 'location-card-copy');
    copy.append(node('span', 'location-card-title', location.title));
    const rounds = node('span', 'card-rounds'); rounds.setAttribute('aria-hidden', 'true');
    for (let round = 0; round < 5; round++) rounds.append(node('span', game.result(location.number, round) ? 'done' : ''));
    copy.append(rounds); card.append(image, top, copy); grid.append(card);
  }
  const resume = game.resumable();
  byId('resumeButton').hidden = !resume;
  if (resume) byId('resumeButton').textContent = `Продолжить ×${resume.number} · раунд ${resume.round + 1} →`;
}

function showMap() { renderMap(); showScreen('map'); }

function resetProgress() {
  if (!game.total() && !game.resumable()) return;
  const confirmed = window.confirm('Начать всё сначала?\n\nБудут удалены все открытия, звёзды, рекорды и незавершённые раунды этой игры в этом браузере. Отменить сброс не получится.');
  if (!confirmed) return;
  if (!game.reset()) {
    window.alert('Браузер не разрешил сбросить сохранение. Прогресс оставлен без изменений. Проверь разрешение на хранение данных и попробуй ещё раз.');
    return;
  }
  Object.assign(view, { number: 2, round: 0, collectionNumber: 2, rewardFromCollection: false });
  showMap();
  byId('saveStatus').textContent = 'Прогресс сброшен. Можно начать сначала!';
}

function showLocation(number = view.number) {
  view.number = number;
  const location = locationData();
  const completed = game.completed(number);
  byId('locationTitle').textContent = location.title;
  byId('locationEyebrow').textContent = `ТАБЛИЦА УМНОЖЕНИЯ НА ${number} · ×${number}`;
  byId('locationProgress').textContent = `${completed} из 5 открытий`;
  const suggested = game.draft(number, view.round) ? view.round : game.nextRound(number);
  byId('locationImage').src = previewImage(number);
  byId('locationImage').alt = `Иллюстрация локации «${location.title}»`;
  const rounds = byId('roundButtons'); rounds.replaceChildren();
  for (let round = 0; round < 5; round++) {
    const result = game.result(number, round);
    const draft = game.draft(number, round);
    const button = actionButton('', 'startRound', `round-button${result ? ' finished' : ''}${round === suggested ? ' suggested' : ''}`, { round });
    button.append(node('strong', '', `Раунд ${round + 1}`));
    button.append(node('span', 'round-stars', result ? starText(result.mistakes) : '◇'));
    button.append(node('small', '', draft ? 'Продолжить' : result ? 'Ещё раз' : 'Исследовать'));
    button.setAttribute('aria-label', `Раунд ${round + 1}. ${draft ? 'Продолжить сохранённую игру' : result ? `Пройдено, ${Multiplication.stars(result.mistakes)} из 3 звёзд. Играть ещё раз` : 'Начать'}`);
    rounds.append(button);
  }
  showScreen('location');
}

function startRound(round = view.round, number = view.number) {
  view.number = number; view.round = round;
  const active = game.start(number, round);
  const location = locationData();
  byId('gameTitle').textContent = `Таблица на ${number}`;
  byId('gameTheme').textContent = location.title.toLocaleUpperCase('ru');
  byId('roundLabel').textContent = `Раунд ${round + 1} / 5`;
  byId('puzzleImage').src = rewardData().image;
  setFeedback(active.selected === null ? 'Выбери любой фрагмент и реши пример.' : 'Игра сохранена. Продолжим с этого примера.');
  renderGame(); showScreen('game');
}

function setFeedback(text, state = '') {
  byId('feedback').textContent = text;
  byId('feedback').className = `feedback ${state}`;
}

function renderGame() {
  const active = game.data.active;
  const tiles = byId('tiles'); tiles.replaceChildren();
  let solved = 0;
  active.questions.forEach((question, index) => {
    if (question.solved) solved++;
    const tile = actionButton('?', 'tile', `tile${question.solved ? ' open' : ''}${active.selected === index ? ' selected' : ''}`, { index });
    tile.disabled = question.solved;
    tile.setAttribute('aria-label', question.solved ? `Фрагмент ${index + 1} открыт` : `Фрагмент ${index + 1}: открыть пример`);
    tile.setAttribute('aria-pressed', String(active.selected === index));
    tiles.append(tile);
  });
  byId('tileCount').textContent = `Открыто ${solved} из 9`;
  byId('tileFill').style.width = `${solved / 9 * 100}%`;
  byId('tileProgress').setAttribute('aria-valuenow', solved);
  byId('mistakeCount').textContent = `Ошибок: ${active.mistakes}`;
  const selected = active.selected === null ? null : active.questions[active.selected];
  byId('question').className = `question${selected ? ' has-question' : ''}`;
  byId('question').textContent = selected ? `${selected.a} × ${selected.b} = ?` : 'Выбери фрагмент со знаком вопроса';
  const answers = byId('answers'); answers.replaceChildren();
  const options = selected ? selected.options : ['·', '·', '·'];
  options.forEach(value => {
    const rejected = selected?.rejected.includes(value);
    const answer = actionButton(value, 'answer', `answer${rejected ? ' wrong' : ''}`, { value });
    answer.disabled = !selected || rejected;
    answer.setAttribute('aria-label', selected ? `Ответ ${value}${rejected ? ', неверно — выбери другой' : ''}` : 'Сначала выбери фрагмент');
    answers.append(answer);
  });
  updateStatus();
}

function chooseTile(index) {
  if (!game.select(index)) return;
  setFeedback('Выбери верный ответ. Ошибаться — часть обучения.');
  renderGame();
  byId('answers').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}

function answer(value) {
  const active = game.data.active;
  if (!active || active.selected === null) return;
  const question = active.questions[active.selected];
  const equation = `${question.a} × ${question.b} = ${question.a * question.b}`;
  const outcome = game.answer(value);
  if (!outcome.accepted) return;
  if (outcome.complete) { showReward(outcome.number, outcome.round, false, outcome); return; }
  if (outcome.correct) {
    setFeedback(`Верно! ${equation}. Открой следующий фрагмент.`, 'success');
  } else {
    const multiplier = question.a === view.number ? question.b : question.a;
    setFeedback(`Попробуй другой ответ. Это ${multiplier} раз по ${view.number}.`, 'retry');
  }
  renderGame();
  if (outcome.correct) byId('tiles').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  else byId('answers').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}

function showReward(number, round, fromCollection = false, outcome = null) {
  const result = game.result(number, round);
  if (!result) return;
  view.number = number; view.round = round; view.rewardFromCollection = fromCollection;
  const reward = rewardData();
  byId('rewardTitle').textContent = reward.title;
  byId('rewardFact').textContent = reward.fact;
  byId('rewardImage').src = reward.image; byId('rewardImage').alt = reward.title;
  byId('rewardContext').textContent = `×${number} · Открытие ${round + 1} / 5`;
  const mistakes = outcome ? outcome.mistakes : result.mistakes;
  byId('rewardStars').textContent = starText(mistakes);
  byId('rewardStars').setAttribute('aria-label', `${Multiplication.stars(mistakes)} из 3 звёзд`);
  byId('rewardEyebrow').textContent = fromCollection ? 'ИЗ ТВОЕЙ КОЛЛЕКЦИИ' : outcome?.first ? 'НОВОЕ ОТКРЫТИЕ!' : 'ОТЛИЧНАЯ ТРЕНИРОВКА!';
  byId('rewardResult').textContent = fromCollection ? `Лучший результат: ошибок — ${result.mistakes}.` : mistakes === 0 ? 'Все 9 примеров без ошибок! Три звезды — твои.' : `Все 9 примеров решены! Ошибок: ${mistakes}.${outcome?.record ? ' Это твой лучший результат.' : ''}`;
  byId('locationComplete').hidden = game.completed(number) !== 5 || fromCollection;
  byId('nextRoundButton').textContent = fromCollection ? 'К коллекции →' : round < 4 ? 'Следующий раунд →' : 'На карту локаций →';
  byId('rewardBack').dataset.action = fromCollection ? 'collection' : 'location';
  byId('rewardBack').replaceChildren(document.createTextNode(fromCollection ? '← Коллекция' : '← Раунды'));
  showScreen('reward');
}

function showCollection(number = view.collectionNumber) {
  view.collectionNumber = number;
  const location = locationData(number);
  byId('collectionSelect').value = String(number);
  byId('collectionProgress').textContent = `${game.completed(number)} / 5`;
  byId('previousCollection').disabled = number === 2;
  byId('nextCollection').disabled = number === 9;
  byId('previousCollection').setAttribute('aria-label', 'Предыдущая локация');
  byId('nextCollection').setAttribute('aria-label', 'Следующая локация');
  const grid = byId('collectionGrid'); grid.replaceChildren();
  location.rewards.forEach((reward, round) => {
    const result = game.result(number, round);
    const card = actionButton('', 'readReward', 'collection-card', { number, round });
    card.disabled = !result;
    const art = node('span', 'collection-art');
    if (result) { const image = node('img'); image.src = reward.image; image.alt = ''; art.append(image); }
    else art.append(node('span', 'locked-symbol', '?'));
    const title = node('span', 'collection-card-title');
    title.append(node('small', '', `Раунд ${round + 1}${result ? ` · ${starText(result.mistakes)}` : ''}`), document.createTextNode(result ? reward.title : 'Открытие впереди'));
    card.append(art, title); grid.append(card);
  });
  showScreen('collection');
}

document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const data = button.dataset;
  switch (data.action) {
    case 'resetProgress': resetProgress(); break;
    case 'map': showMap(); break;
    case 'chooseLocation': showLocation(Number(data.number)); break;
    case 'location': showLocation(); break;
    case 'startRound': startRound(Number(data.round)); break;
    case 'resume': { const draft = game.resumable(); if (draft) startRound(draft.round, draft.number); break; }
    case 'tile': chooseTile(Number(data.index)); break;
    case 'answer': answer(Number(data.value)); break;
    case 'collection': showCollection(['location', 'game', 'reward'].includes(view.screen) ? view.number : view.collectionNumber); break;
    case 'previousCollection': showCollection(Math.max(2, view.collectionNumber - 1)); break;
    case 'nextCollection': showCollection(Math.min(9, view.collectionNumber + 1)); break;
    case 'readReward': showReward(Number(data.number), Number(data.round), true); break;
    case 'next':
      if (view.rewardFromCollection) showCollection();
      else if (view.round < 4) startRound(view.round + 1);
      else showMap();
      break;
  }
});

for (const location of GAME_LOCATIONS) {
  const option = node('option', '', `×${location.number} · ${location.title}`);
  option.value = location.number;
  byId('collectionSelect').append(option);
}
byId('collectionSelect').addEventListener('change', event => showCollection(Number(event.target.value)));
showMap();
