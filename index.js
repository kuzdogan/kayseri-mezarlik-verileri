const puppeteer = require('puppeteer');
const fs = require('fs');
const moment = require('moment');
const csv = require('fast-csv');

const csvStream = csv.format({ headers: true });
const fsWriteStream = fs.createWriteStream('kayseri-data.csv');

const URL = 'https://cbs.kayseri.bel.tr/kayseri-mezarlik-bilgi-sistemi';
const DAYS_AGO = 3; // Number of days to go back.
const CITY_NAME = 'Kayseri';

// Main func
(async () => {
  console.log('Launching Browser');
  // const browser = await puppeteer.launch({ headless: false });
  const browser = await puppeteer.launch({ headless: true });

  // Load page
  console.log('Opened new page');
  const page = await browser.newPage();
  console.log('Going to the URL');
  await page.goto(URL);
  console.log('Loaded page');

  console.log('Clicking menu button')
  await page.click('#aspnetForm > div.page > div.header > div.hideSkiplink > div > ul:nth-child(4) > li > a');
  console.log('Clicked menu button');

  // let date = moment('2020-08-29', 'YYYY-MM-DD');
  let date = moment().subtract(DAYS_AGO, 'days'); // First date

  fsWriteStream.on('error', function (err) {
    console.error(err);
  });
  csvStream.pipe(fsWriteStream).on('end', () => process.exit());

  // Iterate back over days
  for (i = 0; i < DAYS_AGO; i++) { // Most recent date first
    date.add(1, 'days'); // Go one day forward.
    let date2020Str = date.format('DD.MM.YYYY');
    let date2020Filename = date.format('YYYY-MM-DD');
    await changeDateAndSearch(page, date2020Str);
    let count2020 = await countElements(page);
    await scrollToTopAndScreenshot(page, date2020Filename, CITY_NAME);
    await savePagePDF(page, date2020Filename, CITY_NAME);

    // 2019 data
    let date2019 = date.clone().subtract(1, 'years');
    let date2019Str = date2019.format('DD.MM.YYYY');
    let date2019Filename = date2019.format('YYYY-MM-DD');
    await changeDateAndSearch(page, date2019Str);
    let count2019 = await countElements(page);
    await scrollToTopAndScreenshot(page, date2019Filename, CITY_NAME);
    await savePagePDF(page, date2019Filename, CITY_NAME);

    // 2018 data
    let date2018 = date.clone().subtract(2, 'years');
    let date2018Str = date2018.format('DD.MM.YYYY');
    let date2018Filename = date2018.format('YYYY-MM-DD');
    await changeDateAndSearch(page, date2018Str);
    let count2018 = await countElements(page);
    await scrollToTopAndScreenshot(page, date2018Filename, CITY_NAME);
    await savePagePDF(page, date2018Filename, CITY_NAME);

    console.log('==========================');
    console.log('\tTarih: ', date2020Str);
    console.log('\tVefat sayisi: ', count2020);
    console.log('\tTarih: ', date2019Str);
    console.log('\tVefat sayisi: ', count2019);
    console.log('\tTarih: ', date2018Str);
    console.log('\tVefat sayisi: ', count2018);
    csvStream.write({ Tarih: date.format('DD.MM'), VefatSayisi2020: count2020, VefatSayisi2019: count2019, VefatSayisi2018: count2018 });
  }
  csvStream.end();
  await browser.close();
})();


/**
 * Function to change the input date field and simulate click to search.
 * 
 * @param {Object} page - Puppeteer page object 
 * @param {String} dateStr - Date as DD.MM.YYYY string 
 * @param {Boolean} debug - Boolean to wait 5s between each instruction
 * @returns {Promise} That resolves once search is clicked, response received, and DOM updated.
 */
async function changeDateAndSearch(page, dateStr, debug = false) {
  const WAIT = 5000;
  console.log('Changing input');
  debug && await new Promise(resolve => setTimeout(resolve, WAIT));
  await page.focus('#ctl00_MainContent_tlIlanTarihi_dateInput_text');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type(dateStr);
  console.log('Changed input');

  // Focus and press space instead of clicking. Simple click does not work. 
  console.log('Focusing Search')
  debug && await new Promise(resolve => setTimeout(resolve, WAIT));
  await page.focus('#ctl00_MainContent_btnAraVefat');
  console.log('Focused Search')
  console.log('Clicking Search')
  debug && await new Promise(resolve => setTimeout(resolve, WAIT));

  // Wait for click, response, and DOM change to new date.
  return Promise.all([
    page.keyboard.press('Space'),
    page.waitFor((locDateStr) => {
      let newValue = document.querySelector('#ctl00_MainContent_lblTarihi').textContent
      let matchValue = 'Vefat İlan Tarihi : ' + locDateStr
      // console.log('New value: \t', newValue);
      // console.log('Match value : \t', matchValue);
      return newValue === matchValue;
    }, {}, dateStr) // wait until DOM changes to new date. Pass dateStr to browser context as locDateStr.
  ]);
}

/**
 * Function to count number of death announcements in the current page.
 * 
 * @param {Object} page - Puppeteer page object 
 * @returns {Number} Number of deaths
 */
async function countElements(page) {
  return page.$eval('#ctl00_MainContent_UpdatePanel2 > div:nth-child(1)', (elem) => {
    return elem.children.length - 1 // -1 for 'Vefat Ilan Tarihi....' element.
  });
}

async function scrollToTopAndScreenshot(page, dateStr, cityName) {
  console.log('Scrolling to top');
  await page.evaluate(() => window.scrollTo(0, 0));
  console.log('Taking Screenshot');
  await page.screenshot({ path: `./screenshots/${cityName}/${dateStr}.png`, fullPage: true });
  console.log('Took Screenshot');
}

async function savePagePDF(page, dateStr, cityName) {
  console.log('Saving PDF');
  return page.pdf({ path: `./pdfs/${cityName}/${dateStr}.pdf` });
}