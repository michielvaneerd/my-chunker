// import { MarkdownTextSplitter } from "@langchain/textsplitters";
// import { MarkdownHeaderTextSplitter } from "@langchain/textsplitters";
import fs from 'node:fs/promises';
import { getEncoding } from "js-tiktoken";

import { marked } from 'marked';

const markdownText = await fs.readFile('./Full-Markdown.md', { encoding: 'utf8' });
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

let newMarkdown = [];

// https://marked.js.org/using_pro
const walkTokens = (token) => {
    //console.log(token);
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
            //console.log(token.raw);
            newMarkdown.push(token.raw);
            break;
        case 'text':
        case 'list_item':
        case 'link':
        case 'codespan':
        case 'checkbox':
        case 'em':
        case 'strong':
            break;
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
            //     //console.log(token.header.map((h) => h.text).join(', '));
            //     //console.log(token.raw);
            //console.log(rows.join("\n"));
            newMarkdown.push(rows.join("\n"));
            break;
        default:
            //console.log(`${token.type} :: ${token.raw}`);
            //console.log(`${token.raw}`);
            newMarkdown.push(token.raw);
            break;
    }
};

marked.use({ walkTokens });

marked.parse(markdownText);
console.log(newMarkdown.join(""));

// Now chunk, because tables can now be over multiple pages, because we have headers AND values displayed in each row.
// We only need to keep the last header in memory and always add this one to the current chunk.

const chunks = [];
const chunkMaxSize = 512; // tokens if lengthFunction is given, otherwise string length.



//await fs.readFile('./test.md', { encoding: 'utf8' });
await fs.writeFile('./test1.md', newMarkdown.join("\n"), { encoding: 'utf8' });


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
