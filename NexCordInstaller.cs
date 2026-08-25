using System;
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;
using System.Drawing;

class NexCordInstaller
{
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.Run(new InstallerForm());
    }
}

class InstallerForm : Form
{
    public InstallerForm()
    {
        Text = "NexCord Installer";
        Size = new Size(400, 320);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        BackColor = Color.FromArgb(30, 31, 34);

        var title = new Label
        {
            Text = "NexCord",
            Font = new Font("Segoe UI", 24, FontStyle.Bold),
            ForeColor = Color.White,
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Top,
            Height = 70
        };

        var subtitle = new Label
        {
            Text = "Cliente modificado de Discord",
            Font = new Font("Segoe UI", 10),
            ForeColor = Color.Gray,
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Top,
            Height = 30
        };

        var installBtn = CreateButton("Instalar", Color.FromArgb(90, 90, 90));
        installBtn.Click += (s, e) => Install();

        var repairBtn = CreateButton("Reparar / Re-inyectar", Color.FromArgb(70, 70, 70));
        repairBtn.Click += (s, e) => Install();

        var uninstallBtn = CreateButton("Desinstalar", Color.FromArgb(50, 50, 50));
        uninstallBtn.Click += (s, e) => Uninstall();

        var credit = new Label
        {
            Text = "Creado por Gtnnn12",
            Font = new Font("Segoe UI", 9),
            ForeColor = Color.DimGray,
            TextAlign = ContentAlignment.MiddleCenter,
            Dock = DockStyle.Bottom,
            Height = 35
        };

        Controls.Add(credit);
        Controls.Add(uninstallBtn);
        Controls.Add(repairBtn);
        Controls.Add(installBtn);
        Controls.Add(subtitle);
        Controls.Add(title);
    }

    Button CreateButton(string text, Color backColor)
    {
        var btn = new Button
        {
            Text = text,
            BackColor = backColor,
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            Dock = DockStyle.Top,
            Height = 45,
            Margin = new Padding(15),
            Font = new Font("Segoe UI", 12)
        };
        btn.FlatAppearance.BorderSize = 0;
        return btn;
    }

    void Install()
    {
        try
        {
            KillDiscord();
            string discordApp = FindDiscord();
            if (discordApp == null)
            {
                MessageBox.Show("No se encontró Discord instalado.");
                return;
            }

            string res = Path.Combine(discordApp, "resources");
            string temp = ExtractResources();

            TryDeleteDirectory(Path.Combine(res, "app"));
            TryDeleteFile(Path.Combine(res, "app.asar"));
            TryDeleteFile(Path.Combine(res, "NexCord.asar"));
            TryDeleteFile(Path.Combine(res, "_app.asar"));

            File.Copy(Path.Combine(temp, "_app.asar"), Path.Combine(res, "_app.asar"), true);
            File.Copy(Path.Combine(temp, "desktop.asar"), Path.Combine(res, "app.asar"), true);
            File.Copy(Path.Combine(temp, "nightcord.asar"), Path.Combine(res, "NexCord.asar"), true);

            string discordExe = Path.Combine(discordApp, "Discord.exe");
            if (!File.Exists(discordExe))
            {
                MessageBox.Show("No se encontró Discord.exe en:\n" + discordApp);
                return;
            }

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = discordExe,
                    WorkingDirectory = Path.GetDirectoryName(discordExe),
                    UseShellExecute = true
                });
                MessageBox.Show("NexCord instalado correctamente.");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Archivos copiados, pero no se pudo abrir Discord.\n\n" + ex.Message);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show("Error durante la instalación:\n" + ex);
        }
    }

    void Uninstall()
    {
        try
        {
            KillDiscord();
            string discordApp = FindDiscord();
            if (discordApp == null)
            {
                MessageBox.Show("No se encontró Discord instalado.");
                return;
            }

            string res = Path.Combine(discordApp, "resources");

            TryDeleteDirectory(Path.Combine(res, "app"));
            TryDeleteFile(Path.Combine(res, "app.asar"));
            TryDeleteFile(Path.Combine(res, "NexCord.asar"));

            string backup = Path.Combine(res, "_app.asar");
            if (File.Exists(backup))
            {
                File.Copy(backup, Path.Combine(res, "app.asar"), true);
                File.Delete(backup);
            }

            string discordExe = Path.Combine(discordApp, "Discord.exe");
            if (File.Exists(discordExe))
            {
                try { Process.Start(new ProcessStartInfo { FileName = discordExe, WorkingDirectory = Path.GetDirectoryName(discordExe), UseShellExecute = true }); } catch { }
            }

            MessageBox.Show("NexCord desinstalado correctamente.");
        }
        catch (Exception ex)
        {
            MessageBox.Show("Error durante la desinstalación:\n" + ex);
        }
    }

    string ExtractResources()
    {
        string temp = Path.Combine(Path.GetTempPath(), "NexCord");
        Directory.CreateDirectory(temp);

        ExtractResource("_app.asar", Path.Combine(temp, "_app.asar"));
        ExtractResource("desktop.asar", Path.Combine(temp, "desktop.asar"));
        ExtractResource("nightcord.asar", Path.Combine(temp, "nightcord.asar"));

        return temp;
    }

    void ExtractResource(string name, string outputPath)
    {
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        using (FileStream file = new FileStream(outputPath, FileMode.Create))
        {
            stream.CopyTo(file);
        }
    }

    void KillDiscord()
    {
        try
        {
            Process.Start(new ProcessStartInfo("taskkill", "/F /IM Discord.exe")
            {
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            }).WaitForExit();
        }
        catch { }
    }

    string FindDiscord()
    {
        string baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Discord");
        if (!Directory.Exists(baseDir)) return null;

        string preferred = Path.Combine(baseDir, "app-1.0.9254");
        if (File.Exists(Path.Combine(preferred, "Discord.exe"))) return preferred;

        string best = null;
        Version bestVer = null;

        foreach (string dir in Directory.GetDirectories(baseDir, "app-*"))
        {
            string exe = Path.Combine(dir, "Discord.exe");
            if (!File.Exists(exe)) continue;

            string versionText = Path.GetFileName(dir).Replace("app-", "");
            try
            {
                Version v = new Version(versionText);
                if (bestVer == null || v > bestVer)
                {
                    bestVer = v;
                    best = dir;
                }
            }
            catch
            {
                if (best == null) best = dir;
            }
        }

        return best;
    }

    void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
    }

    void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }
}