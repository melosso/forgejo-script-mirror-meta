# Installation

To install the mirror-meta script in your Forgejo instance, you'll have to take the [header.tmpl](header.tmpl) file and put it into your Forgejo custom directory. Specifically, drop it into `custom/templates/custom/header.tmpl`. If that path doesn't exist yet, just create the folders.

For example:

```bash
sudo touch /var/lib/forgejo/custom/templates/custom/header.tmpl
sudo  nano /var/lib/forgejo/custom/templates/custom/header.tmpl
```

Save the file and restart your Forgejo instance so the changes take effect.

```bash
sudo systemctl restart forgejo
```

The script will automatically detect mirrored repositories and fetch Star and Fork counts from the original source (GitHub, GitLab, etc.). As mentioned in the [README](README.md) file, metrics are cached locally for 24 hours to respect API rate limits.