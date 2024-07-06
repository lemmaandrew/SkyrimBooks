/**
 * A (hopefully) one-time script to scrape the Legacy of the Dragonborn wiki to get all the books and store them in a json
 */

const axios = require("axios").default;
const cheerio = require("cheerio");

const HOMEPAGE = "https://legacy-of-the-dragonborn.fandom.com";

/**
 * A simple class keeping track of a book and its locations
 */
class Book {
    /**
     * @param {string} title The book's title
     * @param {string[]} locations The locations the book can be found
     */
    constructor(title, locations) {
        this.title = title;
        this.locations = locations;
    }
}

/**
 * Gets a book from its page
 *
 * @param {string} url The URL of the page of the book
 * @returns Book
 */
async function getBook(url) {
    const {data} = await axios.get(url, {responseType: "text"});
    const $ = cheerio.load(data);
    const title = $("span.mw-page-title-main").text().trim();
    let acquisition = $("div.mw-parser-output > h2:first").next();
    // special case 0: book is Treasure Map XXI
    if (title == "Treasure Map XXI") {
        acquisition = acquisition.next();
    }
    // case 1: multiple locations in a list
    let locations = acquisition.children("li").map(function () {
        return $(this).text().trim();
    }).toArray();
    // case 2: single location in a <p> tag
    if (locations.length == 0) {
        locations = [acquisition.text().trim()];
    }
    // sometimes axios fails to load the page properly so we just repeat this until it works
    // this is probably horrible practice but oh well
    if (title == "" || locations.length == 0) {
        return await getBook(url);
    }
    return new Book(title, locations);
}

/**
 * Gets all the books in a bookshelf
 *
 * @param {cheerio.CheerioAPI} $ The API function.
 * @param {cheerio.Cheerio<cheerio.Element>} ol The `<ol>` element containing the `<li>` of books on the bookshelf
 *
 * @returns {Promise<Book[]>} A promise of an array of all the books in the bookshelf
 */
async function getBookshelf($, ol) {
    let bookPromises = [];
    ol.children("li").each(function () {
        $(this).children("a").each(function () {
            const href = $(this).attr("href");
            // making sure the article is a book
            // "." means that it is a file, and we don't want that
            if (href.startsWith("/wiki/") && !href.includes(".")) {
                bookPromises.push(getBook(HOMEPAGE + $(this).attr("href")));
            }
        });
    });
    const books = await Promise.all(bookPromises);
    return books;
}

/**
 * Get all the books in the first floor of the library
 *
 * @returns {Book[]} All the books on the first floor of the library
 */
async function getFirstFloor() {
    const firstFloorURL = "https://legacy-of-the-dragonborn.fandom.com/wiki/Library_1st_Floor_(SSE)";
    const firstFloorResponse = await axios.get(firstFloorURL, {responseType: "text"});
    const $ = cheerio.load(firstFloorResponse.data);
    // getting the bookshelves
    const ols = $("div.mw-parser-output > ol").toArray().slice(0, 8);
    const bookshelf_books = (await Promise.all(ols.map(ol => getBookshelf($, $(ol))))).flat();
    // getting the tables
    const table_promises = $("table.article-table a").map(function () {
        const href = $(this).attr("href");
        // making sure the article is a book
        // "." means that it is a file, and we don't want that
        if (href.startsWith("/wiki/") && !href.includes(".")) {
            return getBook(HOMEPAGE + href);
        }
    });
    const table_books = await Promise.all(table_promises);
    const all_books = bookshelf_books.concat(table_books);
    // making sure the page properly loaded
    if (all_books.length == 0) {
        return getFirstFloor();
    }
    return all_books;
}

/**
 * Get all the books in the second floor of the library
 *
 * @returns {Book[]} All the books on the second floor of the library
 */
async function getSecondFloor() {
    const secondFloorURL = "https://legacy-of-the-dragonborn.fandom.com/wiki/Library_2nd_Floor_(SSE)";
    const secondFloorResponse = await axios.get(secondFloorURL, {responseType: "text"});
    const $ = cheerio.load(secondFloorResponse.data);
    const table_promises = $("table.article-table a").map(function () {
        const href = $(this).attr("href");
        // making sure the article is a book
        // "." means that it is a file, and we don't want that
        if (href.startsWith("/wiki/") && !href.includes(".")) {
            return getBook(HOMEPAGE + href);
        }
    });
    const books = await Promise.all(table_promises);
    // making sure the page properly loaded
    if (books.length == 0) {
        return getSecondFloor();
    }
    return books;
}

/**
 * Get all the books in the third floor of the library
 *
 * @returns {Book[]} All the books on the third floor of the library
 */
async function getThirdFloor() {
    const thirdFloorURL = "https://legacy-of-the-dragonborn.fandom.com/wiki/Library_3rd_Floor_(SSE)";
    const thirdFloorResponse = await axios.get(thirdFloorURL, {responseType: "text"});
    const $ = cheerio.load(thirdFloorResponse.data);
    const promises = $("table.article-table a").map(function () {
        const href = $(this).attr("href");
        // making sure the article is a book
        // "." means that it is a file, and we don't want that
        if (href.startsWith("/wiki/") && !href.includes(".") && !href.includes("/wiki/Treasure_Hunter")) {
            return getBook(HOMEPAGE + href);
        }
    });
    const books = await Promise.all(promises);
    // making sure the page properly loaded
    if (books.length == 0) {
        return getThirdFloor();
    }
    return books;
}

async function main() {
    const firstFloor = await getFirstFloor();
    const secondFloor = await getSecondFloor();
    const thirdFloor = await getThirdFloor();
    const allBooks = firstFloor.concat(secondFloor, thirdFloor);
    const jsonString = JSON.stringify(allBooks);
    console.log(jsonString);
}

await main();
