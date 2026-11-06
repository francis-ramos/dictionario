import { appendFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import wordListPath from "word-list";

const colors = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  gray: "\u001b[90m",
  reverse: "\u001b[7m",
  red: "\u001b[31m",
};

const historyPath = join(process.cwd(), "words.txt");
const legacyHistoryPath = join(process.cwd(), "selected-words.txt");
const maxSuggestions = 10;

async function loadLines(path: string, missingIsEmpty = false): Promise<string[]> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (
      missingIsEmpty &&
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  return contents
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
}

async function copyToClipboard(word: string): Promise<void> {
  let command: string;
  let args: string[] = [];

  if (process.platform === "win32") {
    command = "clip";
  } else if (process.platform === "darwin") {
    command = "pbcopy";
  } else {
    command = "xclip";
    args = ["-selection", "clipboard"];
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
    let errorOutput = "";

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      errorOutput += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} exited with code ${code}${errorOutput ? `: ${errorOutput.trim()}` : ""}`,
          ),
        );
      }
    });
    child.stdin.end(word);
  });
}

function render(
  query: string,
  suggestions: string[],
  selectedIndex: number,
  status: string,
): void {
  const startIndex = Math.max(
    0,
    Math.min(selectedIndex, suggestions.length - maxSuggestions),
  );
  const visibleSuggestions = suggestions.slice(startIndex, startIndex + maxSuggestions);
  const lines = [
    `${colors.cyan}what word do you wanted to search${colors.reset} ${colors.gray}(a-y matches words starting with a and ending with y; /length N filters words longer than N; /exit quits)${colors.reset}`,
    `> ${query}`,
    "",
  ];

  if (visibleSuggestions.length === 0) {
    lines.push(`${colors.gray}${query ? "No matching words." : "No available words."}${colors.reset}`);
  } else {
    for (const [offset, word] of visibleSuggestions.entries()) {
      const index = startIndex + offset;
      lines.push(
        index === selectedIndex
          ? `${colors.reverse} ${word} ${colors.reset}`
          : `  ${word}`,
      );
    }

    if (suggestions.length > maxSuggestions) {
      lines.push(
        `${colors.gray}Showing ${startIndex + 1}-${startIndex + visibleSuggestions.length} of ${suggestions.length} matches.${colors.reset}`,
      );
    }
  }

  lines.push("", `${colors.gray}↑/↓ select · Enter copy · Backspace edit${colors.reset}`);
  if (status) lines.push(`${colors.green}${status}${colors.reset}`);
  process.stdout.write(`\u001b[2J\u001b[H${lines.join("\n")}`);
}

async function main(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this program in an interactive terminal.");
  }

  const words = Array.from(new Set(await loadLines(wordListPath))).sort((a, b) =>
    a.localeCompare(b),
  );
  const history = await loadLines(historyPath, true);
  const legacyHistory = await loadLines(legacyHistoryPath, true);
  const selectedWords = new Set(
    [...history, ...legacyHistory].map((word) => word.toLocaleLowerCase()),
  );
  const historySet = new Set(history.map((word) => word.toLocaleLowerCase()));
  const missingLegacyWords = legacyHistory.filter(
    (word) => !historySet.has(word.toLocaleLowerCase()),
  );
  if (missingLegacyWords.length > 0) {
    await appendFile(historyPath, `${missingLegacyWords.join("\n")}\n`, "utf8");
  }

  let query = "";
  let selectedIndex = 0;
  let minimumLength: number | null = null;
  let status = "";
  let pendingInput = "";
  let previousWasCarriageReturn = false;

  const getSuggestions = () => {
    const separatorIndex = query.indexOf("-");
    const prefix = (
      separatorIndex === -1 ? query : query.slice(0, separatorIndex)
    ).toLocaleLowerCase();
    const suffix =
      separatorIndex === -1
        ? null
        : query.slice(separatorIndex + 1).toLocaleLowerCase();

    return words.filter((word) => {
      const normalizedWord = word.toLocaleLowerCase();
      return (
        !selectedWords.has(normalizedWord) &&
        (minimumLength === null || word.length > minimumLength) &&
        normalizedWord.startsWith(prefix) &&
        (suffix === null || normalizedWord.endsWith(suffix))
      );
    });
  };

  process.stdin.setRawMode(true);
  process.stdin.resume();

  try {
    render(query, getSuggestions(), selectedIndex, status);

    for await (const chunk of process.stdin) {
      pendingInput += chunk.toString();
      let index = 0;

      while (index < pendingInput.length) {
        if (pendingInput[index] === "\u001b") {
          if (index + 2 >= pendingInput.length) break;

          const sequence = pendingInput.slice(index, index + 3);
          if (sequence === "\u001b[A") {
            selectedIndex = Math.max(0, selectedIndex - 1);
          } else if (sequence === "\u001b[B") {
            selectedIndex = Math.min(getSuggestions().length - 1, selectedIndex + 1);
          }
          index += 3;
          status = "";
          render(query, getSuggestions(), selectedIndex, status);
          continue;
        }

        const key = pendingInput.charAt(index);
        index += 1;

        if (key === "\u0003") return;
        if (key === "\r" || (key === "\n" && !previousWasCarriageReturn)) {
          if (key === "\r") previousWasCarriageReturn = true;
          else previousWasCarriageReturn = false;

          if (query === "/exit") return;

          const lengthCommand = /^\/length(?:\s+(\S+))?\s*$/i.exec(query);
          if (lengthCommand) {
            const argument = lengthCommand[1];
            if (argument?.toLocaleLowerCase() === "off") {
              minimumLength = null;
              query = "";
              selectedIndex = 0;
              status = "Length filter cleared.";
            } else if (argument !== undefined && /^\d+$/.test(argument)) {
              const length = Number(argument);
              if (Number.isSafeInteger(length)) {
                minimumLength = length;
                query = "";
                selectedIndex = 0;
                status = `Showing words longer than ${length} characters.`;
              } else {
                status = "Length must be a safe whole number.";
              }
            } else {
              status = "Usage: /length <number> or /length off.";
            }
            render(query, getSuggestions(), selectedIndex, status);
            continue;
          }

          const suggestions = getSuggestions();
          const word = suggestions[selectedIndex];
          if (word) {
            try {
              await copyToClipboard(word);
              await appendFile(historyPath, `${word}\n`, "utf8");
              selectedWords.add(word.toLocaleLowerCase());
              status = `Copied "${word}" and saved it; it will no longer appear.`;
              query = "";
              selectedIndex = 0;
              render(query, getSuggestions(), selectedIndex, status);
              await new Promise((resolve) => setTimeout(resolve, 900));
              status = "";
            } catch (error) {
              status = `Could not copy or save "${word}": ${error instanceof Error ? error.message : String(error)}`;
            }
          }
        } else {
          previousWasCarriageReturn = false;

          if (key === "\u007f" || key === "\b") {
            query = Array.from(query).slice(0, -1).join("");
            selectedIndex = 0;
          } else if (key >= " " && key !== "\u007f") {
            query += key;
            selectedIndex = 0;
          }
          status = "";
        }

        render(query, getSuggestions(), selectedIndex, status);
      }

      pendingInput = pendingInput.slice(index);
    }
  } finally {
    process.stdin.setRawMode(false);
    process.stdout.write("\u001b[0m\n");
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${colors.red}Error: ${error instanceof Error ? error.message : String(error)}${colors.reset}\n`);
  process.exitCode = 1;
});