"""Build Django ALLOWED_HOSTS from env, always including loopback for health checks."""


def build_allowed_hosts(raw: str | None) -> list[str]:
    default = "127.0.0.1,localhost"
    hosts = [host.strip() for host in (raw or default).split(",") if host.strip()]
    for loopback in ("127.0.0.1", "localhost"):
        if loopback not in hosts:
            hosts.append(loopback)
    return hosts
