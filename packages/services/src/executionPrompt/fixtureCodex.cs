// Native protocol fixture only. This never calls a model and is not live-model evidence.
using System;
using System.IO;
using System.Text;
using System.Threading;
public static class FixtureCodex {
  public static int Main(string[] args) {
    Console.OutputEncoding = new UTF8Encoding(false);
    Console.InputEncoding = new UTF8Encoding(false);
    if (Array.IndexOf(args, "--help") >= 0) { Console.Write("--strict-config --ignore-rules --ephemeral --output-schema --json --model --disable --sandbox"); return 0; }
    if (Array.IndexOf(args, "features") >= 0) {
      foreach (string name in "apps browser_use browser_use_external browser_use_full_cdp_access computer_use image_generation in_app_browser js_repl multi_agent multi_agent_v2 plugins search_tool shell_tool skill_mcp_dependency_install skill_search standalone_web_search unified_exec view_image workspace_dependencies hooks memories goals sleep_tool code_mode tool_suggest recommended_plugins remote_plugin".Split(' ')) Console.WriteLine(name + " stable true");
      return 0;
    }
    if (Array.IndexOf(args, "models") >= 0) { Console.Write("{\"models\":[{\"slug\":\"gpt-test\",\"supported_reasoning_levels\":[{\"effort\":\"low\"}],\"service_tiers\":[{\"id\":\"priority\"}]}]}"); return 0; }
    File.WriteAllText("captured-prompt.json", Console.In.ReadToEnd(), new UTF8Encoding(false));
    File.WriteAllText("captured-env.txt", "database=" + (Environment.GetEnvironmentVariable("DATABASE_URL") != null) + ";credential=" + (Environment.GetEnvironmentVariable("PROVIDER_API_KEY") != null) + ";home=" + Environment.GetEnvironmentVariable("CODEX_HOME"));
    string scenario = File.Exists("scenario.txt") ? File.ReadAllText("scenario.txt") : "success";
    Console.WriteLine("{\"type\":\"thread.started\",\"thread_id\":\"fixture-session\"}");
    Console.WriteLine("{\"type\":\"turn.started\"}");
    if (scenario == "bad-json") { Console.WriteLine("not json"); return 0; }
    if (scenario == "runtime-error") { Console.WriteLine("{\"type\":\"turn.failed\",\"error\":{\"message\":\"fixture failure\"}}"); return 0; }
    if (scenario == "tool") { Console.WriteLine("{\"type\":\"item.started\",\"item\":{\"id\":\"tool\",\"type\":\"command_execution\"}}"); return 0; }
    Console.WriteLine("{\"type\":\"item.completed\",\"item\":{\"id\":\"answer\",\"type\":\"agent_message\",\"text\":\"{\\\"proof\\\":\\\"fixture-ok\\\"}\"}}");
    if (scenario == "callback-block") { Thread.Sleep(120000); return 0; }
    if (scenario != "missing-completion") Console.WriteLine("{\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":1,\"output_tokens\":2}}");
    return scenario == "nonzero" ? 7 : 0;
  }
}
