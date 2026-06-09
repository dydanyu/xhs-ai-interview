import { spawn } from "node:child_process";
import type { Answerer, AnswerInput } from "../types.js";
import { buildAnswerPrompt } from "./prompt.js";

/** 通过 cursor-agent CLI 无头作答。需先安装:curl https://cursor.com/install -fsSL | bash */
export class CursorAgentAnswerer implements Answerer {
  constructor(private cwd: string = process.cwd()) {}

  answer(input: AnswerInput): Promise<void> {
    const prompt = buildAnswerPrompt(input);
    return new Promise((resolve, reject) => {
      const child = spawn(
        "cursor-agent",
        ["-p", prompt, "--force", "--output-format", "text"],
        { cwd: this.cwd, stdio: ["ignore", "inherit", "inherit"] }
      );
      child.on("error", (err) =>
        reject(
          new Error(
            `调用 cursor-agent 失败(是否已安装?curl https://cursor.com/install -fsSL | bash):${err.message}`
          )
        )
      );
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`cursor-agent 退出码 ${code}`))
      );
    });
  }
}
