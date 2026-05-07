import { query } from "@anthropic-ai/claude-agent-sdk";

const prompt = "List the files in the current directory";

// for await (const message of query({ prompt })) {
//   console.log(JSON.stringify(message, null, 2));
// }
for await (const message of query({
  prompt,
  options: { allowedTools: ["Read", "Glob"] },
})) {
  console.log(JSON.stringify(message, null, 2));
}
