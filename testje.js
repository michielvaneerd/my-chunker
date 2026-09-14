// import { MarkdownTextSplitter } from "@langchain/textsplitters";
// import { MarkdownHeaderTextSplitter } from "@langchain/textsplitters";
import fs from 'node:fs/promises';
import { getEncoding } from "js-tiktoken";

import { marked } from 'marked';

const sourceFile = 'file1.md';

const markdownText = await fs.readFile(sourceFile, { encoding: 'utf8' });
//console.log(markdownText);
//process.exit();

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

// een chunk moet bestaan uit een lijst van potentiele chunks, zolang de maxSize nog bereikt is, dan worden die toegevoegd.
// als maxSize bereikt is, dan wordt een nieuwe chunk gemaakt met de laatste als eetrste potentiele chunk.
// Als de eerste chunk te groot is, dan deze met newLines afkorten en als dat niet lukt dan op spaties, punten etc.
// Of misschien andere tokens (text, list_item, etc.)

const chunks = [];
const chunkMaxSize = 512; // tokens if lengthFunction is given, otherwise string length.
const currentChunk = [];

let newMarkdown = [];

//const tokenTypes = [];

// const allowedTokens = [
//     'paragraph',
//     // 'list',
//     // 'table',
//     // 'heading',
//     'blockquote'
// ];

// Child tokens are called before moving on to sibling tokens ==> elke token kan ook weer tokens hebben, dus zichzelf aanroepende functie is nodig.
// Ik denk dat ik bij elke token alle child tokens door moet lopen en de laatste op moet slaan.
// Vervolgens moet ik dan pas weer in actie bij de eerste token NA de laatste child token.

let childTokensToIgnore = new Map();

// TODO: tables, list_Items.

const childItemNames = [
    'tokens',
    'items',
    'rows',
    'header'
];

function getChildTokensToIgnore(token) {
    for (const propertyName of childItemNames) {
        if (token[propertyName] && token[propertyName].length) {
            for (const childToken of token[propertyName]) {
                childTokensToIgnore.set(childToken, true);
                for (const propertyNameChild of childItemNames) {
                    if (childToken[propertyNameChild] && childToken[propertyNameChild].length) {
                        getChildTokensToIgnore(childToken);
                    }
                }
            }
        }
    }

}

// https://marked.js.org/using_pro
const walkTokens = (token) => {
    if (childTokensToIgnore.has(token)) {
        return;
    }
    //console.log(token);
    getChildTokensToIgnore(token);

    //console.log(token.type);
    //return;


    //return;
    // Als de token een property tokens heeft, alleen dan meenemen! Nee klopt niet...
    // Alleen BLOCK level tokens meenemen, want erna komen de inline level tokens die al deel uitmaken van de block level.
    //return;
    switch (token.type) {
        case 'heading':
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
            //newMarkdown.push(token.raw);
            break;
        // case 'text':
        // case 'list_item':
        // case 'link':
        // case 'codespan':
        // case 'checkbox':
        // case 'em':
        // case 'strong':
        // case 'del':
        // case 'image':
        // case 'def':
        // case 'escape':
        //     // Do nothing.
        //     break;
        // case 'paragraph':
        // case 'hr':
        // case 'space':
        // case 'list':
        // case 'blockquote':
        // case 'code':
        //     newMarkdown.push(token.raw);
        //     break;
        case 'table':
            // Return as a list for each row: - header1 = value1, header2 = value2, etc.
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
            //newMarkdown.push(token.raw);
            break;
        default:
            //console.log(`${token.type} :: ${token.raw}`);
            //console.log(`${token.raw}`);
            //newMarkdown.push(token.raw);
            //console.log(token);
            //process.exit();
            break;
    }
    //currentChunk.push(token.raw);
    newMarkdown.push(token.raw);
};

marked.use({ walkTokens });

//console.log(markdownText);
//process.exit();

marked.parse(markdownText);
//console.log(newMarkdown.join(""));

// Now chunk, because tables can now be over multiple pages, because we have headers AND values displayed in each row.
// We only need to keep the last header in memory and always add this one to the current chunk.





//await fs.readFile('./test.md', { encoding: 'utf8' });
await fs.writeFile(`converted-${sourceFile}`, newMarkdown.join(""), { encoding: 'utf8' });
console.log('OK');


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
