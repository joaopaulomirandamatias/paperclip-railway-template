import pc from "picocolors";

export function formatStdoutEvent(line: string, _debug: boolean): void {
  if (line.startsWith("[lemonfox")) {
    console.log(pc.dim(`  ${line}`));
    return;
  }
  if (line === "[user]" || line === "[prompt]") {
    console.log(pc.cyan(`  ${line}`));
    return;
  }
  if (line === "[assistant]") {
    console.log(pc.green(`  ${line}`));
    return;
  }
  if (line === "[transcript]") {
    console.log(pc.magenta(`  ${line}`));
    return;
  }
  if (line.startsWith("[image]")) {
    console.log(pc.yellow(`  ${line}`));
    return;
  }
  console.log(`  ${line}`);
}
