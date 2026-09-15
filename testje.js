// import { MarkdownTextSplitter } from "@langchain/textsplitters";
// import { MarkdownHeaderTextSplitter } from "@langchain/textsplitters";
import fs from 'node:fs/promises';
import { getEncoding } from "js-tiktoken";
import { marked } from 'marked';

const sourceFile = 'file1.md';

// TODO:
// 1. Config keepTablesComplete (if true, never chunk tables even if > maxChunkSize)
// 2. Start header level, for example if you have 1 top level header and all headers fall below,
// then maybe it doesn't make much sense to prepend header 1 to every other headers. So the use level 2 as level 1 etc.
// 3. Config Max header level - for example if this is 3 then header level 4 and higher are just used as is.

const markdownText = await fs.readFile(sourceFile, { encoding: 'utf8' });

const enc = getEncoding("o200k_base");

/// FILO header stack to keep track of the header hierarchy
let headerStack = [];

function fromToken(token) {
    return {
        depth: token.depth,
        text: token.text
    };
}

function lengthFunction(text) {
    return enc.encode(text).length;
}

// A chunk is an Object like
const exampleChunk = {
    headers: ['Header 1', 'Header 2'],
    text: []
};

function newChunk() {
    return {
        headers: [...headerStack],
        text: []
    };
}

const chunks = [];
const chunkMaxSize = 512; // tokens if lengthFunction is given, otherwise string length.
let currentChunk = null;

let newMarkdown = [];

let childTokensToIgnore = new Map();

const childItemNames = [
    'tokens',
    'items',
    'rows',
    'header'
];

/**
 * Walk throuhg all child tokens of the current token and add them to the
 * childTokensToIgnore Map. The `walkTokens` callback of Marked
 * is called for every single token, and walks through all child tokens first
 * before going to the next sibling token. So for example a `paragraph` token
 * is called first, and then the `text` token (which includes the same text as the paragraph).
 * We only need to handle each token once, so that's why we add the child tokens to the ignore map.
 * 
 * @param {Token} token Token to walk through
 */
function getChildTokensToIgnore(token) {
    for (const propertyName of childItemNames) {
        if (token[propertyName] && token[propertyName].length) {
            for (const childToken of token[propertyName]) {
                childTokensToIgnore.set(childToken, true);
                // I think we can comment the next 2 for and if lines,
                // because we already check this in the beginning of this function.
                //for (const propertyNameChild of childItemNames) {
                //    if (childToken[propertyNameChild] && childToken[propertyNameChild].length) {
                getChildTokensToIgnore(childToken);
                //    }
                //}
            }
        }
    }

}

// https://marked.js.org/using_pro
const walkTokens = (token) => {
    if (childTokensToIgnore.has(token)) {
        return;
    }

    getChildTokensToIgnore(token);

    let headerChanged = false;

    switch (token.type) {
        case 'heading':
            headerChanged = true;
            // Headers are updated to reflex the hierarchy, so `## Header 2` becomes
            // `## Header 1 / Header 2`.
            if (headerStack.length === 0) {
                headerStack.push(fromToken(token));
            } else {
                const tmp = headerStack.values();
                headerStack = [];
                for (const value of tmp) {
                    if (value.depth < token.depth) {
                        headerStack.push(value);
                    } else {
                        break;
                    }
                }
                headerStack.push(fromToken(token));
            }
            token.tokens[0].text = headerStack.map((value) => value.text).join(" / ");
            token.raw = '#'.repeat(token.depth) + ' ' + token.tokens[0].text;
            break;
        case 'table':
            // We change a table to a list, where each list item consist of headername1=colvalue1;headername2=colvalue2 etc.
            const rows = [];
            for (const row of token.rows) {
                const cols = [];
                for (let i = 0; i < row.length; i++) {
                    cols.push(`${token.header[i].text} = ${row[i].text}`);
                }
                rows.push(`- ${cols.join('; ')}`);
            }
            token.raw = rows.join("\n");
            token.type = 'list';
            delete token.rows;
            delete token.header;
            token.items = [];
            break;
        default:
            break;
    }
    // If we get here, the token.raw has the correct Markdown text.
    newMarkdown.push(token.raw);
    // Manage the chunking
    // 1. Always add the current header stack to it
    // 2. Always start a new chunk when you encounter a new header
    if (currentChunk === null) {
        currentChunk = newChunk();
    } else if (headerChanged) {
        chunks.push({
            headers: currentChunk.headers,
            text: currentChunk.text
        });
        currentChunk = newChunk();
    }
    currentChunk.text.push(token.raw);
};

marked.use({ walkTokens });

// This call triggers the walkTokens callback.
// We are not interested in the returned HTML value.
marked.parse(markdownText);

// Add last chunk
chunks.push({
    headers: currentChunk.headers,
    text: currentChunk.text
});

//await fs.writeFile(`converted-${sourceFile}`, newMarkdown.join(""), { encoding: 'utf8' });
console.log(chunks);


// async function splitMarkdown() {
//     //     const markdownText = `
//     // # Header 1
//     // This is a paragraph under header 1.

//     // ## Header 2
//     // - List item 1
//     // - List item 2

//     // \`\`\`typescript
//     // console.log("Hello World");
//     // \`\`\`
//     //   `;

//     // const headerTypes = {
//     //     "#": "header_1",
//     //     "##": "header_2",
//     //     "###": "header_3",
//     //     "####": "header_4"
//     // };

//     //

//     

//     // const splitter = new MarkdownHeaderTextSplitter({
//     //     headersToSplitOn: headerTypes,
//     //     returnEachLine: false, // Groups lines under the same header together
//     // });

//     // // Initialize the splitter
//     // // const splitter = new MarkdownTextSplitter({
//     // //     chunkSize: 256,
//     // //     chunkOverlap: 0,
//     // //     lengthFunction: (text) => enc.encode(text).length,
//     // // });

//     // // Create document chunks
//     // const docs = await splitter.createDocuments([markdownText]);

//     // // Print the resulting chunks
//     // docs.forEach((doc, index) => {
//     //     console.log(`Chunk ${index + 1}:`);
//     //     console.log(doc.pageContent);
//     //     console.log(doc.metadata);
//     //     console.log("-".repeat(20));
//     // });
// }

//splitMarkdown();
