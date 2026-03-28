from collections import defaultdict
from datetime import datetime, timedelta
import time

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked_ips = {}
        self.max_requests_per_minute = 30
        self.max_requests_per_hour = 200
        self.block_duration = timedelta(hours=1)
        self.cleanup_interval = timedelta(minutes=5)
        self.last_cleanup = datetime.now()
    
    def is_allowed(self, ip_address: str) -> tuple[bool, str]:
        now = datetime.now()
        
        if self.last_cleanup + self.cleanup_interval < now:
            self._cleanup_old_requests()
            self.last_cleanup = now
        
        if ip_address in self.blocked_ips:
            block_until = self.blocked_ips[ip_address]
            if now < block_until:
                remaining = (block_until - now).total_seconds()
                return False, f"IP bị chặn. Vui lòng thử lại sau {int(remaining/60)} phút."
            else:
                del self.blocked_ips[ip_address]
        
        request_times = self.requests[ip_address]
        now_timestamp = now.timestamp()
        
        request_times.append(now_timestamp)
        
        one_minute_ago = now_timestamp - 60
        one_hour_ago = now_timestamp - 3600
        
        recent_requests = [t for t in request_times if t > one_minute_ago]
        hourly_requests = [t for t in request_times if t > one_hour_ago]
        
        self.requests[ip_address] = recent_requests
        
        if len(recent_requests) > self.max_requests_per_minute:
            self.blocked_ips[ip_address] = now + self.block_duration
            return False, "Quá nhiều yêu cầu. IP của bạn đã bị chặn tạm thời."
        
        if len(hourly_requests) > self.max_requests_per_hour:
            self.blocked_ips[ip_address] = now + self.block_duration
            return False, "Quá nhiều yêu cầu trong giờ. IP của bạn đã bị chặn tạm thời."
        
        return True, "OK"
    
    def _cleanup_old_requests(self):
        now = datetime.now().timestamp()
        one_hour_ago = now - 3600
        
        ips_to_remove = []
        for ip, request_times in self.requests.items():
            self.requests[ip] = [t for t in request_times if t > one_hour_ago]
            if not self.requests[ip]:
                ips_to_remove.append(ip)
        
        for ip in ips_to_remove:
            del self.requests[ip]
        
        now_dt = datetime.now()
        blocked_to_remove = [ip for ip, block_until in self.blocked_ips.items() if now_dt >= block_until]
        for ip in blocked_to_remove:
            del self.blocked_ips[ip]
    
    def get_stats(self, ip_address: str) -> dict:
        now = datetime.now().timestamp()
        one_minute_ago = now - 60
        one_hour_ago = now - 3600
        
        request_times = self.requests.get(ip_address, [])
        recent_count = len([t for t in request_times if t > one_minute_ago])
        hourly_count = len([t for t in request_times if t > one_hour_ago])
        
        is_blocked = ip_address in self.blocked_ips
        block_until = self.blocked_ips.get(ip_address)
        
        return {
            'recent_requests': recent_count,
            'hourly_requests': hourly_count,
            'is_blocked': is_blocked,
            'block_until': block_until.isoformat() if block_until else None
        }

rate_limiter = RateLimiter()

















