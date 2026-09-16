using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.Win32;

public class LectureHost {
  static JavaScriptSerializer json = new JavaScriptSerializer();
  static Stream input = Console.OpenStandardInput(), output = Console.OpenStandardOutput();
  static void Send(object value) {
    byte[] bytes = Encoding.UTF8.GetBytes(json.Serialize(value));
    output.Write(BitConverter.GetBytes(bytes.Length),0,4); output.Write(bytes,0,bytes.Length); output.Flush();
  }
  static byte[] Read(int count) {
    byte[] bytes = new byte[count]; int offset = 0;
    while (offset < count) { int n = input.Read(bytes,offset,count-offset); if(n == 0) return null; offset += n; }
    return bytes;
  }
  static string Folder() {
    string path = null;
    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders")) {
      if(key != null) path = key.GetValue("{374DE290-123F-4565-9164-39C4925E467B}") as string;
    }
    if(String.IsNullOrEmpty(path)) path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
    return Path.Combine(Environment.ExpandEnvironmentVariables(path), "Lecture Videos");
  }
  static string FFmpeg() {
    string paths = (Environment.GetEnvironmentVariable("PATH") ?? "") + ";" + Environment.GetEnvironmentVariable("PATH",EnvironmentVariableTarget.User) + ";" + Environment.GetEnvironmentVariable("PATH",EnvironmentVariableTarget.Machine);
    foreach(string part in paths.Split(';')) {
      try { string candidate = Path.Combine(Environment.ExpandEnvironmentVariables(part.Trim().Trim('"')), "ffmpeg.exe"); if(File.Exists(candidate)) return candidate; } catch {}
    }
    string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "WinGet", "Packages");
    if(Directory.Exists(root)) foreach(string dir in Directory.GetDirectories(root,"Gyan.FFmpeg*")) {
      try { string[] matches = Directory.GetFiles(dir,"ffmpeg.exe",SearchOption.AllDirectories); if(matches.Length > 0) return matches[0]; } catch(UnauthorizedAccessException) {}
    }
    throw new Exception("FFmpeg was not found. Install FFmpeg, then try Download again.");
  }
  static string Arg(string value) {
    StringBuilder result = new StringBuilder("\""); int slashes = 0;
    foreach(char c in value) {
      if(c == '\\') { slashes++; continue; }
      if(c == '"') { result.Append('\\', slashes * 2 + 1); result.Append(c); slashes = 0; continue; }
      result.Append('\\',slashes); slashes = 0; result.Append(c);
    }
    result.Append('\\',slashes * 2); return result.Append('"').ToString();
  }
  static string Get(Dictionary<string,object> data, string key) { return data.ContainsKey(key) ? Convert.ToString(data[key]) : ""; }
  static Dictionary<string,object> GetObject(Dictionary<string,object> data,string key) {
    object value; return data.TryGetValue(key,out value) ? value as Dictionary<string,object> : null;
  }
  static bool BrowserHeaderHost(Uri uri) {
    return uri.Host.EndsWith("udemy.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("udemycdn.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("cloudfront.net",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("instagram.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("cdninstagram.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("facebook.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("fbcdn.net",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("tiktok.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("tiktokcdn.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("tiktokv.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("byteoversea.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("ibytedtos.com",StringComparison.OrdinalIgnoreCase);
  }
  static bool RangeCookieHost(Uri uri) {
    return uri.Host.EndsWith("instagram.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("cdninstagram.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("tiktok.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("tiktokcdn.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("tiktokv.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("byteoversea.com",StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("ibytedtos.com",StringComparison.OrdinalIgnoreCase);
  }
  static string InputOptions(Uri uri, Uri page, Dictionary<string,object> headers) {
    string inputOptions="";
    if(page!=null && page.Scheme=="https" && (page.Host=="www.udemy.com"||page.Host=="www.apnacollege.in"||page.Host.EndsWith("facebook.com",StringComparison.OrdinalIgnoreCase)||page.Host.EndsWith("instagram.com",StringComparison.OrdinalIgnoreCase)||page.Host.EndsWith("tiktok.com",StringComparison.OrdinalIgnoreCase)))inputOptions+=" -referer "+Arg(page.GetLeftPart(UriPartial.Path));
    if(headers!=null && BrowserHeaderHost(uri)) {
      string ua = headers.ContainsKey("User-Agent") ? Convert.ToString(headers["User-Agent"]) : "";
      if(ua.Length>0 && ua.Length<300 && ua.IndexOfAny(new char[]{'\r','\n'})<0)inputOptions+=" -user_agent "+Arg(ua);
      StringBuilder raw = new StringBuilder();
      HashSet<string> keep = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      foreach(string allowed in new string[]{"Accept","Accept-Language","Origin","Referer","Sec-Fetch-Dest","Sec-Fetch-Mode","Sec-Fetch-Site","Sec-CH-UA","Sec-CH-UA-Mobile","Sec-CH-UA-Platform"})keep.Add(allowed);
      if(RangeCookieHost(uri)){keep.Add("Range");keep.Add("Cookie");}
      foreach(string headerName in headers.Keys) {
        string lower=headerName.ToLowerInvariant();
        if(!System.Text.RegularExpressions.Regex.IsMatch(headerName,@"\A[A-Za-z0-9-]+\z"))continue;
        if(!keep.Contains(headerName))continue;
        if(!headers.ContainsKey(headerName))continue;
        string value=Convert.ToString(headers[headerName]);
        int max=lower=="cookie"?12000:8192;
        if(value.Length==0 || value.Length>max || value.IndexOfAny(new char[]{'\r','\n'})>=0)continue;
        if(lower=="range")value="bytes=0-";
        raw.Append(headerName).Append(": ").Append(value).Append("\r\n");
      }
      if(raw.Length>0)inputOptions+=" -headers "+Arg(raw.ToString());
    }
    return inputOptions;
  }
  public static bool SupportsMediaUrl(string value,string format) {
    Uri uri;
    if(!Uri.TryCreate(value,UriKind.Absolute,out uri)||uri.Scheme!="https"||uri.UserInfo.Length>0||!uri.IsDefaultPort)return false;
    bool host=false;
    foreach(string root in new string[]{"wistia.com","wistia.net","udemy.com","udemycdn.com","cloudfront.net","instagram.com","cdninstagram.com","facebook.com","fbcdn.net","tiktok.com","tiktokcdn.com","tiktokv.com","byteoversea.com","ibytedtos.com"})if(uri.Host.Equals(root,StringComparison.OrdinalIgnoreCase)||uri.Host.EndsWith("."+root,StringComparison.OrdinalIgnoreCase))host=true;
    if(!host)return false;
    return System.Text.RegularExpressions.Regex.IsMatch(uri.AbsolutePath,@"\.(m3u8|mp4|mpd)$",System.Text.RegularExpressions.RegexOptions.IgnoreCase) || format=="MP4" || format=="HLS" || format=="DASH";
  }
  static string RecordsFolder() { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"LectureSaver","Records"); }
  public static string RecordPath(string target,string records) {
    string key;
    using(SHA256 sha=SHA256.Create())key=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(target).ToUpperInvariant()))).Replace("-","").ToLowerInvariant();
    return Path.Combine(records,key+".txt");
  }
  public static void MigrateRecords(string folder,string records) {
    if(!Directory.Exists(folder))return;
    foreach(string legacy in Directory.GetFiles(folder,"*.mp4.source",SearchOption.TopDirectoryOnly)) {
      try {
        string video=legacy.Substring(0,legacy.Length-7);
        if(!File.Exists(video) || new FileInfo(legacy).Length>64)continue;
        string hash=File.ReadAllText(legacy);
        if(!System.Text.RegularExpressions.Regex.IsMatch(hash,@"\A[0-9a-f]{8}\z"))continue;
        string destination=RecordPath(video,records);Directory.CreateDirectory(records);
        if(!File.Exists(destination))File.Move(legacy,destination);
        else if(File.ReadAllText(destination)==hash)File.Delete(legacy);
      }catch(IOException){}catch(UnauthorizedAccessException){}
    }
  }
  public static bool AlreadySaved(string target,string hash,string records) {
    try {string record=RecordPath(target,records);return File.Exists(target)&&File.Exists(record)&&File.ReadAllText(record)==hash;}catch{return false;}
  }
  public static void SaveRecord(string target,string hash,string records) {
    Directory.CreateDirectory(records);File.WriteAllText(RecordPath(target,records),hash);
  }
  public static string CleanName(string name) {
    if(name.EndsWith(".mp4",StringComparison.OrdinalIgnoreCase)) name=name.Substring(0,name.Length-4);
    foreach(char c in Path.GetInvalidFileNameChars()) name=name.Replace(c,'_');
    name=name.Trim().TrimEnd('.'); if(name.Length>100)name=name.Substring(0,100).TrimEnd('.',' ');if(name.Length==0)name="Video";
    if(System.Text.RegularExpressions.Regex.IsMatch(name,@"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])($|\.)",System.Text.RegularExpressions.RegexOptions.IgnoreCase))name="_"+name;
    return name;
  }
  static void Handle(Dictionary<string,object> data) {
    string id = Get(data,"id");
    try {
      string folder = Folder();
      string records=RecordsFolder();
      try { MigrateRecords(folder,records); }catch(IOException){}catch(UnauthorizedAccessException){}
      if(Get(data,"action") == "ping") { Send(new {id=id,state="ready",folder=folder,ffmpeg=FFmpeg(),helperVersion="4.0.8",recordMode="private-records",udemyMedia=true,sessionHeaders=true,browserRequestHeaders=true,socialMedia=true,multiInput=true}); return; }
      if(Get(data,"action") == "open") {
        Directory.CreateDirectory(folder);
        Process.Start(new ProcessStartInfo("explorer.exe",Arg(folder)) {UseShellExecute=false});
        Send(new {id=id,state="opened",folder=folder}); return;
      }
      if(Get(data,"action") != "download") throw new Exception("Unknown action");
      Uri uri;
      if(!SupportsMediaUrl(Get(data,"url"),Get(data,"format")))throw new Exception("This media host or format is not supported.");
      uri=new Uri(Get(data,"url"));
      Uri audioUri=null;
      if(Get(data,"audioUrl").Length>0) {
        if(!SupportsMediaUrl(Get(data,"audioUrl"),"MP4"))throw new Exception("This audio host or format is not supported.");
        audioUri=new Uri(Get(data,"audioUrl"));
      }
      string name = CleanName(Get(data,"name"));
      string identity=uri.Host.EndsWith(".wistia.com")||uri.Host.EndsWith(".wistia.net")?uri.AbsolutePath:uri.Host+uri.AbsolutePath+(audioUri==null?"":"|"+audioUri.Host+audioUri.AbsolutePath);
      string hash; using(SHA256 sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(identity))).Replace("-","").Substring(0,8).ToLowerInvariant();
      Directory.CreateDirectory(folder);
      string target = Path.Combine(folder,name + ".mp4");
      int suffix=1;
      while(File.Exists(target)) {
        if(AlreadySaved(target,hash,records)) {Send(new {id=id,state="done",path=target,message="Already downloaded"});return;}
        target=Path.Combine(folder,name+" ("+suffix++ +").mp4");
      }
      string partial = target + ".partial.mp4";
      Uri page=null;Uri parsedPage;
      if(Uri.TryCreate(Get(data,"page"),UriKind.Absolute,out parsedPage))page=parsedPage;
      string inputOptions=InputOptions(uri,page,GetObject(data,"headers"));
      string args = "-hide_banner -loglevel error -nostdin -y -rw_timeout 20000000"+inputOptions+" -i " + Arg(uri.AbsoluteUri);
      if(audioUri!=null)args+=InputOptions(audioUri,page,GetObject(data,"audioHeaders"))+" -i "+Arg(audioUri.AbsoluteUri)+" -map 0:v:0 -map 1:a:0?";
      else args+=" -map 0:v:0 -map 0:a:0?";
      args+=" -c copy -movflags +faststart -progress pipe:1 " + Arg(partial);
      ProcessStartInfo info = new ProcessStartInfo(FFmpeg(),args) {UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
      StringBuilder errors = new StringBuilder();
      using(Process process = new Process()) {
        process.StartInfo = info;
        process.ErrorDataReceived += delegate(object sender,DataReceivedEventArgs e) { if(e.Data != null && errors.Length < 4000) errors.AppendLine(e.Data); };
        process.Start(); process.BeginErrorReadLine();
        Send(new {id=id,state="downloading",path=target});
        string line;
        while((line=process.StandardOutput.ReadLine()) != null) {
          if(line.StartsWith("out_time=")) Send(new {id=id,state="downloading",time=line.Substring(9),path=target});
        }
        process.WaitForExit();
        if(process.ExitCode != 0) throw new Exception("Download failed. Play the video again and retry. " + errors.ToString());
      }
      File.Move(partial,target);
      try {SaveRecord(target,hash,records);}catch(IOException){}catch(UnauthorizedAccessException){}
      Send(new {id=id,state="done",path=target});
    } catch(Exception e) { Send(new {id=id,state="error",message=e.Message}); }
  }
  public static void Main() {
    try {
      for(;;) {
        byte[] header = Read(4); if(header == null) return;
        int length = BitConverter.ToInt32(header,0); if(length < 1 || length > 1048576) return;
        byte[] payload = Read(length); if(payload == null) return;
        Handle(json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(payload)));
      }
    } catch { Environment.ExitCode = 1; }
  }
}
