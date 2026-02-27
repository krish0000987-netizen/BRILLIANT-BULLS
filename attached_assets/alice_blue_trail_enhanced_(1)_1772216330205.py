#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ENHANCED ORB STRATEGY - FIXED 5-MINUTE VERSION
===============================================
✅ FIXED: Now uses 5-minute candles matching your charts
✅ FIXED: Scans only at 5-min candle closes (9:35, 9:40, 9:45...)
✅ FIXED: All validations use 5-min timeframe data
"""

import os
import sys
import csv
import logging
import requests
from datetime import datetime, date, time as dt_time, timedelta
from pathlib import Path
import time as time_module
from collections import defaultdict

# ─── Global session token (set at login, used for direct API calls) ──────────
_SESSION_TOKEN = ""

try:
    import pandas as pd
except:
    print("❌ ERROR: pandas not installed")
    sys.exit(1)

try:
    from pya3 import Aliceblue, TransactionType, OrderType, ProductType
    print("✅ pya3 imported successfully")
except ImportError as e:
    print(f"❌ ERROR: pya3 import failed: {e}")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================
class Config:
    """Configuration loaded from CSV"""
    CONFIG_CSV_PATH = Path.home() / ".aliceblue_orb_simple" / "config.csv"

    USER_ID = "2579193"
    API_KEY = "l5A22roeakhT5RfPs7kjETi0xqMgJaB8uyanZMpnmVfG4ueoo5jciDAl9nljvpvq1u8ENMrQ5DXP0W0oDYFzV3uELU4v01xSQ02cd92CJIKUv2enYo09DgEGA3tkJzhS"

    BASE_DIR = Path.home() / ".aliceblue_orb_simple"
    BASE_DIR.mkdir(exist_ok=True, parents=True)

    TRADE_LOG_CSV = BASE_DIR / "trades.csv"

    BULLISH_STOCKS = [
        'SBIN',
        'JKTYRE',
        'KAYNES',
        'PFIZER',
        'PVRINOX',
        'POLICYBZR',
        'KIRLOSOIL',
        'FORTIS',
        'EICHERMOT',
        'ENDURANCE',
        'CHAMBLFERT',
        'VOLTAS',
        'ASTRAL',
        'NH',
        'BBTC',
        'APOLLOHOSP',
        'DIVISLAB',
        'BHARATFORG',
        'CARBORUNIV',
        'SJVN',
        'ABSLAMC',
        'PGEL',
        'IDEA',
        'SAGILITY',
        'ZFCVINDIA',
        'PIIND',
        'TVSMOTOR',
        'CRAFTSMAN',
        'LAURUSLABS',
        'CHOLAHLDNG',
        'JYOTICNC',
        'SUPREMEIND',
        'MAXHEALTH',
    ]

    BEARISH_STOCKS = [
        'KPRMILL',
        'MASTEK',
        'POLYMED',
        'AAVAS',
        'KANSAINER',
        'MCX',
        'FSL',
        'NUVAMA',
        'NEWGEN',
        'TATAELXSI',
        'BHEL',
        'PERSISTENT',
        'RAYMONDLSL',
        'TRITURBINE',
        'LTIM',
        'TCS',
    ]

    CAPITAL = 5000.0
    RISK_PER_TRADE = 0.005
    MAX_DAILY_TRADES = 4

    MARKET_START = dt_time(9, 15)
    MARKET_END = dt_time(15, 30)
    AUTO_SQUAREOFF_TIME = dt_time(15, 10)

    # ORB Range filter
    ORB_RANGE_FILTER = True
    MIN_RANGE_PCT = 0.5
    MAX_RANGE_PCT = 1.49

    EMA_PERIOD = 8
    MIN_CANDLE_SIZE_MULTIPLIER = 0.5
    MAX_CANDLE_SIZE_MULTIPLIER = 1.0
    MAX_WICK_PCT = 25.0

    ATR_PERIOD = 14
    ATR_SL_BUFFER_PCT = 2.0

    POSITION_CHECK_INTERVAL = 1.0
    CANDLE_INTERVAL_MINUTES = 5
    STATUS_DISPLAY_INTERVAL = 60

    PAPER_TRADING = False
    TEST_MODE = False
    DEBUG_MODE = True
    API_CALL_DELAY = 0.5

    @classmethod
    def load_from_csv(cls):
        """Load all configuration from CSV"""
        if not cls.CONFIG_CSV_PATH.exists():
            logger.info("⚠️  No CSV config found, using defaults")
            return False

        try:
            logger.info(f"📄 Loading config from: {cls.CONFIG_CSV_PATH}")
            with open(cls.CONFIG_CSV_PATH, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                row = next(reader)

                cls.USER_ID          = row['user_id'].strip()
                cls.API_KEY          = row['api_key'].strip()

                cls.BULLISH_STOCKS   = [s.strip() for s in row['bullish_stocks'].split(',') if s.strip()]
                cls.BEARISH_STOCKS   = [s.strip() for s in row['bearish_stocks'].split(',') if s.strip()]

                cls.CAPITAL          = float(row['capital'])
                cls.RISK_PER_TRADE   = float(row['risk_per_trade'])
                cls.MAX_DAILY_TRADES = int(row['max_daily_trades'])

                cls.PAPER_TRADING    = row['paper_trading'].strip().lower() in ['true','1','yes','y']
                cls.TEST_MODE        = row['test_mode'].strip().lower()   in ['true','1','yes','y']

                # ORB range filter: yes = enable with min/max, no = disable (accept all ranges)
                cls.ORB_RANGE_FILTER = row['orb_range_filter'].strip().lower() in ['true','1','yes','y']
                if cls.ORB_RANGE_FILTER:
                    cls.MIN_RANGE_PCT = float(row['min_range_pct'])
                    cls.MAX_RANGE_PCT = float(row['max_range_pct'])

                logger.info("✅ CSV config loaded successfully")
                logger.info(f"   User ID          : {cls.USER_ID}")
                logger.info(f"   Bullish Stocks   : {len(cls.BULLISH_STOCKS)}")
                logger.info(f"   Bearish Stocks   : {len(cls.BEARISH_STOCKS)}")
                logger.info(f"   Capital          : ₹{cls.CAPITAL:,.2f}")
                logger.info(f"   Risk Per Trade   : {cls.RISK_PER_TRADE*100:.2f}%")
                logger.info(f"   Max Daily Trades : {cls.MAX_DAILY_TRADES}")
                logger.info(f"   Paper Trading    : {'YES ✅' if cls.PAPER_TRADING else 'NO 🔴'}")
                logger.info(f"   Test Mode        : {'YES ⚠️' if cls.TEST_MODE else 'NO'}")
                if cls.ORB_RANGE_FILTER:
                    logger.info(f"   ORB Range Filter : ENABLED ({cls.MIN_RANGE_PCT}% – {cls.MAX_RANGE_PCT}%)")
                else:
                    logger.info(f"   ORB Range Filter : DISABLED (all ranges accepted)")
                return True

        except Exception as e:
            logger.error(f"❌ Error loading CSV: {e}")
            logger.info("Using default configuration")
            return False

# ============================================================================
# LOGGING
# ============================================================================
def setup_logging():
    log_dir = Config.BASE_DIR / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"orb_enhanced_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

    log_level = logging.DEBUG if Config.DEBUG_MODE else logging.INFO

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger("ORB_Enhanced")

logger = setup_logging()

def is_market_open():
    if Config.TEST_MODE:
        return True
    now = datetime.now()
    current_time = now.time()
    if now.weekday() >= 5:
        return False
    return Config.MARKET_START <= current_time <= Config.MARKET_END

def should_squareoff():
    if Config.TEST_MODE:
        return False
    return datetime.now().time() >= Config.AUTO_SQUAREOFF_TIME

def wait_for_market():
    if Config.TEST_MODE:
        logger.info("⚠️ TEST MODE: Bypassing market hours check")
        return True

    now = datetime.now()
    current_time = now.time()

    if now.weekday() >= 5:
        logger.warning("⚠️ TODAY IS WEEKEND - Market closed")
        return False

    # ── Phase 1: Wait for market to open (9:15 AM) ──────────────────────────
    if current_time < Config.MARKET_START:
        market_open_dt = datetime.combine(now.date(), Config.MARKET_START)
        logger.info(f"⏰ Market opens at {Config.MARKET_START} — waiting...")
        try:
            while True:
                now = datetime.now()
                remaining = (market_open_dt - now).total_seconds()
                if remaining <= 0:
                    break
                mins  = int(remaining // 60)
                secs  = int(remaining % 60)
                print(f"\r⏳ Market opens in {mins:02d}m {secs:02d}s ...   ", end='', flush=True)
                time_module.sleep(1)
            print()  # newline after countdown
        except KeyboardInterrupt:
            logger.info("\n⚠️ Cancelled")
            return False

    # ── Phase 2: Wait for ORB window to complete (9:30 AM) ──────────────────
    now = datetime.now()
    orb_ready_dt = datetime.combine(now.date(), Config.MARKET_START) + timedelta(minutes=15)

    if now < orb_ready_dt:
        logger.info("⏰ Waiting for ORB range to form (9:15 – 9:30 AM)...")
        try:
            while True:
                now = datetime.now()
                remaining = (orb_ready_dt - now).total_seconds()
                if remaining <= 0:
                    break
                mins = int(remaining // 60)
                secs = int(remaining % 60)
                print(f"\r⏳ ORB window closes in {mins:02d}m {secs:02d}s ...   ", end='', flush=True)
                time_module.sleep(1)
            print()
        except KeyboardInterrupt:
            logger.info("\n⚠️ Cancelled")
            return False

    logger.info("✅ Market is open and ORB range is ready!")
    return True

# ✅ NEW FUNCTION: Calculate next 5-minute candle close time
def get_next_5min_candle_close():
    """Returns the next 5-minute candle close time"""
    now = datetime.now()
    current_minute = now.minute
    current_second = now.second

    # Round up to next 5-minute boundary
    minutes_to_next = Config.CANDLE_INTERVAL_MINUTES - (current_minute % Config.CANDLE_INTERVAL_MINUTES)

    if minutes_to_next == Config.CANDLE_INTERVAL_MINUTES and current_second == 0:
        # We're exactly at a 5-min boundary
        return now

    next_close = now + timedelta(minutes=minutes_to_next, seconds=-current_second)
    next_close = next_close.replace(microsecond=0)

    return next_close

# ✅ NEW FUNCTION: Check if we're at a 5-minute candle close
def is_5min_candle_close():
    """Check if current time is a 5-minute candle close (9:35, 9:40, 9:45...)"""
    now = datetime.now()
    # Check if minute is divisible by 5 and seconds are between 0-2 (small buffer for timing)
    return (now.minute % Config.CANDLE_INTERVAL_MINUTES == 0) and (now.second <= 2)

def login_to_aliceblue():
    global _SESSION_TOKEN
    try:
        logger.info("=" * 80)
        logger.info("🔐 LOGGING IN TO ALICEBLUE")
        logger.info("=" * 80)

        alice = Aliceblue(user_id=Config.USER_ID, api_key=Config.API_KEY)
        session = alice.get_session_id()

        if session and session.get('stat') == 'Ok':
            logger.info("✅ Connected successfully!")

            # ── FIX: Capture session token for direct API calls ────────────
            _SESSION_TOKEN = session.get('susertoken', '')
            if not _SESSION_TOKEN:
                logger.warning("⚠️ susertoken missing – trying accessToken field")
                _SESSION_TOKEN = session.get('accessToken', '')
            if _SESSION_TOKEN:
                logger.info(f"✅ Session token captured (len={len(_SESSION_TOKEN)})")
            else:
                logger.error("❌ Could not capture session token – historical data will fail!")

            # Try contract master (non-fatal if it fails)
            try:
                logger.info("Downloading contract master...")
                alice.get_contract_master('NSE')
                logger.info("✅ Contract master downloaded")
            except Exception as e:
                logger.warning(f"⚠️ Contract master download failed: {str(e)[:80]}")
                logger.warning("⚠️ Using direct HTTP fallback for historical data")

            logger.info("=" * 80)
            return alice
        else:
            logger.error(f"❌ Session response: {session}")
            return None

    except Exception as e:
        logger.error(f"❌ Login failed: {e}")
        return None

def ensure_trade_log():
    if Config.TRADE_LOG_CSV.exists():
        return
    try:
        with open(Config.TRADE_LOG_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Timestamp", "Symbol", "Side", "Qty", "Entry", "StopLoss",
                "Target", "Exit", "PnL", "ExitReason", "OrderID", "Status",
                "Direction", "EntryTime", "ExitTime"
            ])
    except:
        pass

def log_trade(trade_data):
    try:
        with open(Config.TRADE_LOG_CSV, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(trade_data)
    except:
        pass

def create_instrument_mapping(alice, symbols):
    logger.info(f"📊 Creating instrument mapping for {len(symbols)} stocks...")
    mapping = {}
    success_count = 0
    failed_symbols = []

    for symbol in symbols:
        try:
            # Try method 1: get_instrument_by_symbol
            instrument = alice.get_instrument_by_symbol('NSE', symbol)

            if instrument and len(instrument) >= 2:
                mapping[symbol] = {
                    'token': instrument[1],
                    'symbol': symbol,
                    'instrument': instrument
                }
                success_count += 1
                continue

        except Exception as e:
            logger.debug(f"get_instrument_by_symbol failed for {symbol}: {e}")

        # Try method 2: search_instruments as fallback
        try:
            search_result = alice.search_instruments('NSE', symbol)
            if search_result and len(search_result) > 0:
                # The ticker is in the 'name' attribute as 'SBIN-EQ'
                # The 'symbol' attribute has full company name
                exact_match = None
                for item in search_result:
                    if hasattr(item, 'name') and item.name and item.name.startswith(f"{symbol}-"):
                        # Prefer EQ (equity) segment
                        if item.name.endswith('-EQ'):
                            exact_match = item
                            break
                        # But accept any if no EQ found
                        if exact_match is None:
                            exact_match = item

                if exact_match and hasattr(exact_match, 'token'):
                    # Store the actual Instrument object for compatibility
                    mapping[symbol] = {
                        'token': exact_match.token,
                        'symbol': symbol,
                        'instrument': exact_match  # Store the Instrument object directly
                    }
                    success_count += 1
                    logger.info(f"   ✅ {symbol:<12} - Valid (Token: {exact_match.token})")
                    continue
        except Exception as e:
            logger.debug(f"search_instruments failed for {symbol}: {e}")

        # If both methods failed
        failed_symbols.append(symbol)
        logger.warning(f"   ❌ {symbol:<12} - Not found")

    logger.info(f"\n✅ Mapped {success_count}/{len(symbols)} instruments")

    if failed_symbols:
        logger.warning(f"⚠️ Failed: {', '.join(failed_symbols)}")

    return mapping

class StockStatusTracker:
    def __init__(self):
        self.stock_status = {}
        self.last_display_time = datetime.now()

    def update_stock_status(self, symbol, status_data):
        self.stock_status[symbol] = status_data

    def display_status(self, force=False):
        now = datetime.now()
        if not force and (now - self.last_display_time).seconds < Config.STATUS_DISPLAY_INTERVAL:
            return

        self.last_display_time = now
        if not self.stock_status:
            return

        logger.info("\n" + "=" * 120)
        logger.info("📊 STOCK MONITORING STATUS (5-MIN TIMEFRAME)")
        logger.info("=" * 120)
        logger.info(f"{'Symbol':<12} {'Dir':<6} {'ORB Low':<10} {'ORB High':<10} {'Range%':<8} "
                    f"{'CMP':<10} {'Status':<15} {'EMA':<5} {'Vol':<5} {'Dist%':<8} {'Info':<20}")
        logger.info("-" * 120)

        for symbol in sorted(self.stock_status.keys()):
            data = self.stock_status[symbol]
            orb_low = data.get('orb_low', 0)
            orb_high = data.get('orb_high', 0)
            orb_range = data.get('orb_range_pct', 0)
            cmp = data.get('current_price', 0)
            direction = data.get('direction', 'N/A')
            status = data.get('breakout_status', 'UNKNOWN')
            ema_touch = '✅' if data.get('ema_touch', False) else '❌'
            volume_ok = '✅' if data.get('volume_ok', False) else '❌'
            dist = data.get('distance_to_breakout', 0)
            info = data.get('additional_info', '')

            if status == 'DONE':
                status_display = f"🟢 {status}"
            elif status == 'PENDING':
                status_display = f"🟡 {status}"
            elif status == 'NO_SETUP':
                status_display = f"⚪ {status}"
            else:
                status_display = f"🔴 {status}"

            logger.info(f"{symbol:<12} {direction:<6} {orb_low:<10.2f} {orb_high:<10.2f} {orb_range:<8.2f} "
                        f"{cmp:<10.2f} {status_display:<20} {ema_touch:<5} {volume_ok:<5} {dist:<8.2f} {info:<20}")

        logger.info("=" * 120)

# ============================================================================
# DATA FETCHER - DIRECT HTTP for historical data (bypasses pya3 401 bug)
# ============================================================================
class DataFetcher:
    CHART_URL = "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/chart/history"

    def __init__(self, alice):
        self.alice = alice

    def _get_token_and_exchange(self, instrument):
        """Extract token and exchange from an instrument object."""
        if hasattr(instrument, 'token'):
            token    = str(instrument.token)
            exchange = getattr(instrument, 'exchange', 'NSE')
        elif isinstance(instrument, (list, tuple)) and len(instrument) >= 2:
            token    = str(instrument[1])
            exchange = 'NSE'
        else:
            token    = str(instrument)
            exchange = 'NSE'
        return token, exchange

    def get_scrip_info(self, instrument):
        try:
            scrip_info = self.alice.get_scrip_info(instrument)
            if scrip_info and isinstance(scrip_info, dict):
                return {
                    'ltp':    float(scrip_info.get('LTP', 0)),
                    'open':   float(scrip_info.get('OpenPrice', 0)),
                    'high':   float(scrip_info.get('High', 0)),
                    'low':    float(scrip_info.get('Low', 0)),
                    'close':  float(scrip_info.get('Close', 0)),
                    'volume': int(scrip_info.get('Volume', 0))
                }
        except:
            pass
        return None

    def get_historical_data(self, instrument, from_date, to_date, interval):
        """
        Fetch historical OHLCV data.
        PRIMARY:  direct HTTP call to AliceBlue chart API (avoids pya3 401 bug)
        FALLBACK: pya3 get_historical
        Returns a DataFrame or None.
        """
        global _SESSION_TOKEN
        logger.debug(f"Fetching: {from_date} to {to_date}, interval={interval}")

        token, exchange = self._get_token_and_exchange(instrument)

        # ── PRIMARY: direct HTTP ─────────────────────────────────────────────
        if _SESSION_TOKEN:
            df = self._fetch_via_direct_http(
                token, exchange, from_date, to_date, interval, _SESSION_TOKEN
            )
            if df is not None:
                return df
            logger.debug("Direct HTTP failed – trying pya3 fallback")

        # ── FALLBACK: pya3 get_historical ────────────────────────────────────
        return self._fetch_via_pya3(instrument, from_date, to_date, interval)

    # ── Direct HTTP helper ───────────────────────────────────────────────────
    def _fetch_via_direct_http(self, token, exchange, from_date, to_date, interval, session_token):
        try:
            from_ts = int(from_date.timestamp())
            to_ts   = int(to_date.timestamp())

            payload = {
                "symbol":     f"{exchange}:{token}",
                "from":       str(from_ts),
                "to":         str(to_ts),
                "resolution": str(interval),
                "userId":     Config.USER_ID,
                "susertoken": session_token,
            }
            headers = {
                "Authorization": f"Bearer {session_token}",
                "Content-Type":  "application/json",
            }

            resp = requests.post(self.CHART_URL, json=payload, headers=headers, timeout=10)
            logger.debug(f"Direct HTTP status: {resp.status_code}")

            if resp.status_code != 200:
                logger.debug(f"HTTP {resp.status_code}: {resp.text[:100]}")
                return None

            data = resp.json()

            if data.get('stat') == 'Not_Ok' or 't' not in data:
                logger.debug(f"Bad response: {data}")
                return None

            timestamps = data['t']
            if not timestamps:
                logger.debug("Empty timestamp array")
                return None

            # Build DataFrame – timestamps are Unix seconds, AliceBlue sends IST
            df = pd.DataFrame({
                'datetime': pd.to_datetime(timestamps, unit='s'),
                'open':     [float(x) for x in data.get('o', [])],
                'high':     [float(x) for x in data.get('h', [])],
                'low':      [float(x) for x in data.get('l', [])],
                'close':    [float(x) for x in data.get('c', [])],
                'volume':   [int(x)   for x in data.get('v', [])],
            })

            # AliceBlue returns UTC; convert to IST (+5:30)
            df['datetime'] = df['datetime'] + pd.Timedelta(hours=5, minutes=30)

            df = df.sort_values('datetime').reset_index(drop=True)
            logger.debug(f"✅ Direct HTTP: {len(df)} candles")
            return df

        except Exception as e:
            logger.debug(f"Direct HTTP exception: {e}")
            return None

    # ── pya3 fallback helper ─────────────────────────────────────────────────
    def _fetch_via_pya3(self, instrument, from_date, to_date, interval):
        try:
            data = self.alice.get_historical(
                instrument=instrument,
                from_datetime=from_date,
                to_datetime=to_date,
                interval=1,
                indices=False
            )

            if isinstance(data, pd.DataFrame):
                df = data
            elif isinstance(data, dict):
                if data.get('stat') == 'Not_Ok':
                    return None
                raw = data.get('data', data.get('result', None))
                if raw is None:
                    return None
                df = pd.DataFrame(raw)
            else:
                return None

            if df.empty:
                return None

            # Normalise column names
            time_col = next((c for c in ['datetime', 'time', 'timestamp', 't'] if c in df.columns), None)
            if not time_col:
                return None
            df.rename(columns={time_col: 'datetime'}, inplace=True)
            df['datetime'] = pd.to_datetime(df['datetime'])

            for col in ['high', 'low', 'open', 'close', 'volume']:
                if col not in df.columns:
                    return None

            df = df.sort_values('datetime').reset_index(drop=True)
            logger.debug(f"✅ pya3 fallback: {len(df)} candles")
            return df

        except Exception as e:
            logger.debug(f"pya3 fallback error: {e}")
            return None

    # ✅ Aggregate 1-min candles to 5-min candles
    def aggregate_to_5min(self, df_1min):
        try:
            if df_1min is None or df_1min.empty:
                return None

            df_1min = df_1min.set_index('datetime')
            df_5min = df_1min.resample('5min').agg({
                'open':   'first',
                'high':   'max',
                'low':    'min',
                'close':  'last',
                'volume': 'sum'
            })
            df_5min = df_5min.dropna().reset_index()
            logger.debug(f"✅ Aggregated {len(df_1min)} 1-min → {len(df_5min)} 5-min candles")
            return df_5min

        except Exception as e:
            logger.debug(f"Error aggregating to 5-min: {e}")
            return None

# ============================================================================
# ORB SCANNER - UPDATED FOR 5-MINUTE CANDLES
# ============================================================================
class ORBScanner:
    def __init__(self, alice, data_fetcher, instrument_map, status_tracker):
        self.alice = alice
        self.data_fetcher = data_fetcher
        self.instrument_map = instrument_map
        self.status_tracker = status_tracker
        self.orb_data_cache = {}
        self.breakout_done = set()

    def calculate_atr(self, df, period=14):
        if len(df) < period:
            return None

        high = df['high'].values
        low = df['low'].values
        close = df['close'].values

        tr_list = []
        for i in range(1, len(df)):
            tr = max(
                high[i] - low[i],
                abs(high[i] - close[i-1]),
                abs(low[i] - close[i-1])
            )
            tr_list.append(tr)

        if len(tr_list) < period:
            return None

        atr = sum(tr_list[-period:]) / period
        return atr

    def calculate_ema(self, df, period=8):
        if len(df) < period:
            return None
        return df['close'].ewm(span=period, adjust=False).iloc[-1]

    def get_orb_range(self, symbol, instrument):
        """Calculate ORB range using 1-min data (9:15-9:30)"""

        if symbol in self.orb_data_cache:
            return self.orb_data_cache[symbol]

        now = datetime.now()
        today_9_15 = datetime.combine(now.date(), dt_time(9, 15))
        today_9_30 = datetime.combine(now.date(), dt_time(9, 30))

        try:
            logger.debug(f"{symbol}: Fetching ORB data")

            # Get 1-minute candles for the day
            df = self.data_fetcher.get_historical_data(
                instrument, today_9_15, now, "1"
            )

            if df is None or df.empty:
                logger.debug(f"{symbol}: No data returned")
                return None

            # Filter for ORB period (9:15-9:30)
            df['datetime'] = pd.to_datetime(df['datetime'])
            orb_end_time = datetime.combine(now.date(), dt_time(9, 30))
            df_orb = df[df['datetime'] <= orb_end_time]

            if len(df_orb) < 2:
                logger.debug(f"{symbol}: Only {len(df_orb)} candles in ORB period")
                return None

            orb_high = df_orb['high'].max()
            orb_low = df_orb['low'].min()
            orb_range = ((orb_high - orb_low) / orb_low) * 100

            orb_data = {
                'high': orb_high,
                'low': orb_low,
                'range_pct': orb_range
            }

            self.orb_data_cache[symbol] = orb_data
            logger.info(f"✅ {symbol}: ORB High={orb_high:.2f}, Low={orb_low:.2f}, Range={orb_range:.2f}%")
            return orb_data

        except Exception as e:
            logger.debug(f"{symbol}: ORB error - {str(e)}")
            if Config.DEBUG_MODE:
                import traceback
                logger.debug(f"Traceback:\n{traceback.format_exc()}")
            return None

    def scan_for_breakout(self, symbol, instrument, expected_direction):
        """
        ✅ FIXED: Scan for valid breakout setups using 5-MINUTE candles
        This now matches what you see on your charts!
        """
        try:
            orb_data = self.get_orb_range(symbol, instrument)
            if not orb_data:
                self.status_tracker.update_stock_status(symbol, {
                    'orb_high': 0, 'orb_low': 0, 'orb_range_pct': 0, 'current_price': 0,
                    'direction': expected_direction, 'breakout_status': 'NO_SETUP',
                    'ema_touch': False, 'volume_ok': False, 'distance_to_breakout': 0,
                    'additional_info': 'No ORB data'
                })
                return None, None, None

            orb_high = orb_data['high']
            orb_low = orb_data['low']
            orb_range_pct = orb_data['range_pct']

            # Only apply range filter if it is enabled in config
            if Config.ORB_RANGE_FILTER and not (Config.MIN_RANGE_PCT <= orb_range_pct <= Config.MAX_RANGE_PCT):
                self.status_tracker.update_stock_status(symbol, {
                    'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                    'current_price': 0, 'direction': expected_direction,
                    'breakout_status': 'RANGE_INVALID', 'ema_touch': False, 'volume_ok': False,
                    'distance_to_breakout': 0, 'additional_info': f'Range {orb_range_pct:.2f}%'
                })
                return None, None, None

            scrip_info = self.data_fetcher.get_scrip_info(instrument)
            if not scrip_info:
                return None, None, None

            ltp = scrip_info['ltp']

            if expected_direction == 'LONG':
                distance_to_breakout = ((orb_high - ltp) / ltp) * 100
            else:
                distance_to_breakout = ((ltp - orb_low) / ltp) * 100

            if symbol in self.breakout_done:
                self.status_tracker.update_stock_status(symbol, {
                    'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                    'current_price': ltp, 'direction': expected_direction, 'breakout_status': 'DONE',
                    'ema_touch': False, 'volume_ok': False, 'distance_to_breakout': distance_to_breakout,
                    'additional_info': 'Already traded'
                })
                return None, None, None

            breakout = False
            if expected_direction == 'LONG' and ltp > orb_high:
                breakout = True
            elif expected_direction == 'SHORT' and ltp < orb_low:
                breakout = True

            if not breakout:
                self.status_tracker.update_stock_status(symbol, {
                    'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                    'current_price': ltp, 'direction': expected_direction, 'breakout_status': 'PENDING',
                    'ema_touch': False, 'volume_ok': False, 'distance_to_breakout': distance_to_breakout,
                    'additional_info': f'{distance_to_breakout:.2f}% to BO'
                })
                return None, None, None

            # ✅ CRITICAL FIX: Get 5-minute candles for validation
            now = datetime.now()
            today_start = datetime.combine(now.date(), dt_time(9, 15))

            # First get 1-min data
            df_1min = self.data_fetcher.get_historical_data(instrument, today_start, now, "1")

            if df_1min is None or df_1min.empty or len(df_1min) < 2:
                logger.debug(f"{symbol}: Can't validate - no intraday data")
                return None, None, None

            # ✅ NEW: Convert to 5-minute candles
            df_5min = self.data_fetcher.aggregate_to_5min(df_1min)

            if df_5min is None or df_5min.empty or len(df_5min) < 2:
                logger.debug(f"{symbol}: Can't validate - no 5-min candles")
                return None, None, None

            # ✅ FIXED: Use last CLOSED 5-minute candle for validation
            latest_candle = df_5min.iloc[-1]

            # ✅ FIXED: Calculate 8 EMA on 5-minute timeframe
            ema = self.calculate_ema(df_5min, Config.EMA_PERIOD)

            ema_touch = False
            if ema:
                ema_touch = latest_candle['low'] <= ema <= latest_candle['high']

            # ✅ FIXED: Compare volume of last two 5-min candles
            volume_ok = False
            if len(df_5min) >= 2:
                volume_ok = latest_candle['volume'] > df_5min.iloc[-2]['volume']

            # ✅ FIXED: Calculate wick on 5-min candle
            candle_range = latest_candle['high'] - latest_candle['low']
            if candle_range == 0:
                return None, None, None

            if expected_direction == 'LONG':
                upper_wick = latest_candle['high'] - max(latest_candle['open'], latest_candle['close'])
                wick_pct = (upper_wick / candle_range) * 100
            else:
                lower_wick = min(latest_candle['open'], latest_candle['close']) - latest_candle['low']
                wick_pct = (lower_wick / candle_range) * 100

            wick_ok = wick_pct <= Config.MAX_WICK_PCT

            if ema_touch and volume_ok and wick_ok:
                self.breakout_done.add(symbol)

                # ✅ FIXED: Calculate ATR on 5-min data
                atr = self.calculate_atr(df_5min, Config.ATR_PERIOD)

                breakout_data = {
                    'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                    'atr': atr, 'ema': ema, 'entry_candle': latest_candle.to_dict()
                }

                self.status_tracker.update_stock_status(symbol, {
                    'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                    'current_price': ltp, 'direction': expected_direction, 'breakout_status': 'DONE',
                    'ema_touch': True, 'volume_ok': True, 'distance_to_breakout': 0,
                    'additional_info': '5-min BO confirmed!'
                })

                logger.info(f"✅ {symbol} - {expected_direction} breakout at ₹{ltp:.2f} [5-MIN CANDLE]")
                return expected_direction, ltp, breakout_data
            else:
                status_info = []
                if not ema_touch:
                    status_info.append('No EMA')
                if not volume_ok:
                    status_info.append('Low vol')
                if not wick_ok:
                    status_info.append(f'Wick {wick_pct:.0f}%')

                self.status_tracker.update_stock_status(symbol, {
                    'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                    'current_price': ltp, 'direction': expected_direction, 'breakout_status': 'NO_SETUP',
                    'ema_touch': ema_touch, 'volume_ok': volume_ok, 'distance_to_breakout': 0,
                    'additional_info': ', '.join(status_info)
                })

                return None, None, None

        except Exception as e:
            logger.debug(f"{symbol}: Breakout scan error - {str(e)}")
            return None, None, None

# Position Manager - keeping the same as before
class PositionManager:
    def __init__(self, alice, data_fetcher):
        self.alice = alice
        self.data_fetcher = data_fetcher
        self.positions = {}
        self.closed_positions = []
        self.daily_trades = 0
        self.total_pnl = 0.0

    def can_open_position(self):
        return self.daily_trades < Config.MAX_DAILY_TRADES

    def open_position(self, symbol, instrument, side, entry_price, breakout_data, expected_direction):
        if not self.can_open_position():
            logger.warning(f"❌ Max trades reached")
            return False

        if symbol in self.positions:
            logger.warning(f"❌ {symbol} position exists")
            return False

        try:
            risk_amount = Config.CAPITAL * Config.RISK_PER_TRADE
            atr = breakout_data.get('atr', 0)

            if atr and atr > 0:
                sl_distance = atr * (Config.ATR_SL_BUFFER_PCT / 100)
            else:
                sl_distance = entry_price * 0.01

            if expected_direction == 'LONG':
                stop_loss = entry_price - sl_distance
                target = entry_price + (2 * sl_distance)
            else:
                stop_loss = entry_price + sl_distance
                target = entry_price - (2 * sl_distance)

            qty = int(risk_amount / sl_distance)
            if qty == 0:
                qty = 1

            if Config.PAPER_TRADING or Config.TEST_MODE:
                order_id = f"PAPER_{datetime.now().strftime('%H%M%S')}"
                logger.info(f"📝 PAPER: {side} {qty} {symbol} @ ₹{entry_price:.2f}")
            else:
                transaction_type = TransactionType.Buy if side == 'BUY' else TransactionType.Sell
                order = self.alice.place_order(
                    transaction_type=transaction_type,
                    instrument=instrument,
                    quantity=qty,
                    order_type=OrderType.Market,
                    product_type=ProductType.Intraday
                )
                order_id = order.get('NOrdNo', 'UNKNOWN')
                logger.info(f"✅ ORDER: {side} {qty} {symbol} @ ₹{entry_price:.2f}")

            self.positions[symbol] = {
                'symbol': symbol, 'instrument': instrument, 'side': side, 'qty': qty,
                'entry': entry_price, 'stop_loss': stop_loss, 'target': target,
                'order_id': order_id, 'entry_time': datetime.now(),
                'direction': expected_direction, 'breakout_data': breakout_data
            }

            self.daily_trades += 1
            logger.info(f"   SL: ₹{stop_loss:.2f} | Target: ₹{target:.2f}")
            return True

        except Exception as e:
            logger.error(f"❌ Error opening {symbol}: {e}")
            return False

    def close_position(self, symbol, exit_price, exit_reason):
        if symbol not in self.positions:
            return

        pos = self.positions[symbol]

        try:
            if Config.PAPER_TRADING or Config.TEST_MODE:
                logger.info(f"📝 EXIT: {symbol} @ ₹{exit_price:.2f} | {exit_reason}")
            else:
                transaction_type = TransactionType.Sell if pos['side'] == 'BUY' else TransactionType.Buy
                self.alice.place_order(
                    transaction_type=transaction_type,
                    instrument=pos['instrument'],
                    quantity=pos['qty'],
                    order_type=OrderType.Market,
                    product_type=ProductType.Intraday
                )
                logger.info(f"✅ EXIT: {symbol} @ ₹{exit_price:.2f} | {exit_reason}")

            if pos['side'] == 'BUY':
                pnl = (exit_price - pos['entry']) * pos['qty']
            else:
                pnl = (pos['entry'] - exit_price) * pos['qty']

            self.total_pnl += pnl

            trade_data = [
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'), symbol, pos['side'], pos['qty'],
                pos['entry'], pos['stop_loss'], pos['target'], exit_price, pnl, exit_reason,
                pos['order_id'], 'Closed', pos['direction'],
                pos['entry_time'].strftime('%Y-%m-%d %H:%M:%S'),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ]
            log_trade(trade_data)

            logger.info(f"💰 P&L: ₹{pnl:.2f} | Total: ₹{self.total_pnl:.2f}")

            self.closed_positions.append(pos)
            del self.positions[symbol]

        except Exception as e:
            logger.error(f"❌ Error closing {symbol}: {e}")

    def monitor_positions(self):
        for symbol in list(self.positions.keys()):
            pos = self.positions[symbol]
            try:
                scrip_info = self.data_fetcher.get_scrip_info(pos['instrument'])
                if not scrip_info:
                    continue

                ltp = scrip_info['ltp']

                if pos['side'] == 'BUY':
                    if ltp <= pos['stop_loss']:
                        self.close_position(symbol, ltp, 'Stop Loss')
                    elif ltp >= pos['target']:
                        self.close_position(symbol, ltp, 'Target')
                else:
                    if ltp >= pos['stop_loss']:
                        self.close_position(symbol, ltp, 'Stop Loss')
                    elif ltp <= pos['target']:
                        self.close_position(symbol, ltp, 'Target')
            except:
                pass

    def squareoff_all(self):
        logger.info("\n⚠️ Squaring off all positions...")
        for symbol in list(self.positions.keys()):
            pos = self.positions[symbol]
            try:
                scrip_info = self.data_fetcher.get_scrip_info(pos['instrument'])
                if scrip_info:
                    self.close_position(symbol, scrip_info['ltp'], 'Auto Square-off')
            except:
                pass

    def get_stats(self):
        return {
            'active_positions': len(self.positions),
            'closed_positions': len(self.closed_positions),
            'daily_trades': self.daily_trades,
            'total_pnl': self.total_pnl
        }

def run_strategy(alice):
    logger.info("\n" + "=" * 80)
    logger.info("🚀 ENHANCED ORB STRATEGY - 5-MINUTE CANDLE VERSION")
    logger.info("=" * 80)

    if not wait_for_market():
        return

    all_stocks_with_direction = []
    for stock in Config.BULLISH_STOCKS:
        all_stocks_with_direction.append((stock, 'LONG'))
    for stock in Config.BEARISH_STOCKS:
        all_stocks_with_direction.append((stock, 'SHORT'))

    all_symbols = [stock for stock, _ in all_stocks_with_direction]
    instrument_map = create_instrument_mapping(alice, all_symbols)

    if not instrument_map:
        logger.error("❌ Failed to map instruments")
        return

    for symbol, direction in all_stocks_with_direction:
        if symbol in instrument_map:
            instrument_map[symbol]['direction'] = direction

    data_fetcher = DataFetcher(alice)
    status_tracker = StockStatusTracker()
    orb_scanner = ORBScanner(alice, data_fetcher, instrument_map, status_tracker)
    position_manager = PositionManager(alice, data_fetcher)

    logger.info("\n" + "=" * 80)
    logger.info("📊 CALCULATING ORB RANGES (9:15-9:30 AM)")
    logger.info("=" * 80)

    orb_passed = []
    orb_failed = []
    orb_no_data = []

    for symbol, stock_data in instrument_map.items():
        try:
            instrument = stock_data['instrument']
            direction = stock_data['direction']
            orb_data = orb_scanner.get_orb_range(symbol, instrument)

            if orb_data:
                orb_high = orb_data['high']
                orb_low = orb_data['low']
                orb_range_pct = orb_data['range_pct']

                # ── ORB Range Filter ────────────────────────────────────────
                if not Config.ORB_RANGE_FILTER:
                    # Filter disabled — accept every stock regardless of range
                    orb_passed.append({
                        'symbol': symbol, 'direction': direction,
                        'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct
                    })
                elif Config.MIN_RANGE_PCT <= orb_range_pct <= Config.MAX_RANGE_PCT:
                    # Filter enabled and range is within bounds
                    orb_passed.append({
                        'symbol': symbol, 'direction': direction,
                        'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct
                    })
                else:
                    # Filter enabled but range is out of bounds
                    orb_failed.append({
                        'symbol': symbol, 'direction': direction,
                        'orb_high': orb_high, 'orb_low': orb_low, 'orb_range_pct': orb_range_pct,
                        'reason': f"Range {orb_range_pct:.2f}% outside {Config.MIN_RANGE_PCT}-{Config.MAX_RANGE_PCT}%"
                    })
            else:
                orb_no_data.append({'symbol': symbol, 'direction': direction, 'reason': 'No ORB data'})
        except Exception as e:
            orb_no_data.append({'symbol': symbol, 'direction': direction, 'reason': str(e)[:30]})

        time_module.sleep(0.1)

    filter_label = f"ENABLED ({Config.MIN_RANGE_PCT}%-{Config.MAX_RANGE_PCT}%)" if Config.ORB_RANGE_FILTER else "DISABLED"
    logger.info(f"\n📊 ORB Range Filter: {filter_label}")
    logger.info(f"\n✅ PASSED ORB FILTER: {len(orb_passed)}")
    for s in sorted(orb_passed, key=lambda x: x['symbol']):
        logger.info(f"   {s['symbol']:<12} {s['direction']:<6} Range: {s['orb_range_pct']:.2f}%")

    if orb_failed:
        logger.info(f"\n❌ FAILED (out of range): {len(orb_failed)}")
        for s in sorted(orb_failed, key=lambda x: x['symbol']):
            logger.info(f"   {s['symbol']:<12} {s['reason']}")

    if orb_no_data:
        logger.info(f"\n⚠️ NO DATA: {len(orb_no_data)}")
        for s in sorted(orb_no_data, key=lambda x: x['symbol']):
            logger.info(f"   {s['symbol']:<12} {s['reason']}")

    if len(orb_passed) == 0:
        logger.warning("\n⚠️ NO STOCKS AVAILABLE FOR TRADING")
        return

    logger.info(f"\n✅ {len(orb_passed)} stocks ready for monitoring")
    logger.info("=" * 80)

    # ✅ NEW: Wait until first 5-minute candle close
    next_candle_time = get_next_5min_candle_close()
    logger.info(f"\n⏰ Waiting for first 5-min candle close at {next_candle_time.strftime('%H:%M:%S')}")

    # ✅ NEW: Track which candle we've scanned to avoid duplicate scans
    last_scanned_candle_time = None
    scan_count = 0

    try:
        while is_market_open():
            if should_squareoff():
                logger.info("\n⏰ Auto square-off!")
                position_manager.squareoff_all()
                break

            # Monitor positions every second
            position_manager.monitor_positions()
            status_tracker.display_status()

            # ✅ FIXED: Check if we're at a 5-minute candle close
            current_time = datetime.now()
            current_minute = current_time.minute
            current_second = current_time.second

            # Check if it's a 5-min boundary (9:35, 9:40, 9:45, etc.)
            if (current_minute % Config.CANDLE_INTERVAL_MINUTES == 0 and
                    current_second <= 2 and  # Small buffer for timing
                    last_scanned_candle_time != current_time.replace(second=0, microsecond=0)):

                # ✅ NEW: This is a 5-minute candle close!
                scan_count += 1
                last_scanned_candle_time = current_time.replace(second=0, microsecond=0)

                logger.info(f"\n{'='*80}")
                logger.info(f"🕐 5-MIN CANDLE CLOSED at {current_time.strftime('%H:%M:%S')}")
                logger.info(f"🔍 SCAN #{scan_count} - Checking for breakouts")
                logger.info(f"{'='*80}")

                setups_found = 0
                for symbol, stock_data in instrument_map.items():
                    if symbol not in [s['symbol'] for s in orb_passed]:
                        continue

                    if not position_manager.can_open_position():
                        logger.info("Max trades reached")
                        break

                    instrument = stock_data['instrument']
                    expected_direction = stock_data['direction']

                    direction, price, breakout_data = orb_scanner.scan_for_breakout(
                        symbol, instrument, expected_direction
                    )

                    if direction:
                        setups_found += 1
                        side = 'BUY' if direction == 'LONG' else 'SELL'
                        position_manager.open_position(
                            symbol, instrument, side, price, breakout_data, expected_direction
                        )
                        time_module.sleep(Config.API_CALL_DELAY)

                status_tracker.display_status(force=True)

                if setups_found == 0:
                    logger.info("No new breakouts found on this 5-min candle")

                stats = position_manager.get_stats()
                logger.info(f"\n📊 Active: {stats['active_positions']} | Closed: {stats['closed_positions']} | P&L: ₹{stats['total_pnl']:.2f}")

            time_module.sleep(Config.POSITION_CHECK_INTERVAL)

    except KeyboardInterrupt:
        logger.info("\n⚠️ Interrupted by user")
        position_manager.squareoff_all()
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        stats = position_manager.get_stats()
        logger.info("\n" + "=" * 80)
        logger.info("📊 FINAL SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total Trades: {stats['daily_trades']}")
        logger.info(f"Active: {stats['active_positions']} | Closed: {stats['closed_positions']}")
        logger.info(f"Total P&L: ₹{stats['total_pnl']:.2f}")
        logger.info("=" * 80)

def main():
    logger.info("\n" + "=" * 80)
    logger.info("ENHANCED ORB STRATEGY - 5-MINUTE CANDLE VERSION")
    logger.info("✅ Now scans at 5-min candle closes (9:35, 9:40, 9:45...)")
    logger.info("✅ All validation uses 5-min timeframe data")
    logger.info("=" * 80)
    logger.info(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Load CSV configuration if available
    Config.load_from_csv()

    logger.info("\n📊 STOCKS:")
    logger.info(f"   Bullish: {', '.join(Config.BULLISH_STOCKS)}")
    logger.info(f"   Bearish: {', '.join(Config.BEARISH_STOCKS)}")

    if not Config.PAPER_TRADING:
        logger.error("\n🚨 LIVE TRADING MODE!")
        logger.error(f"Capital: ₹{Config.CAPITAL:,.2f}")
        if not Config.TEST_MODE:
            logger.error("Press Ctrl+C within 10s to cancel...")
            try:
                for i in range(10, 0, -1):
                    print(f"\r⏳ {i}s... ", end='', flush=True)
                    time_module.sleep(1)
                print("\n")
            except KeyboardInterrupt:
                logger.info("\n✅ CANCELLED")
                return
    else:
        logger.info("✅ PAPER TRADING mode")

    if Config.TEST_MODE:
        logger.warning("⚠️ TEST MODE - Bypassing market hours")

    ensure_trade_log()
    alice = login_to_aliceblue()

    if not alice:
        logger.error("❌ Failed to login")
        return

    run_strategy(alice)

    logger.info("\n" + "=" * 80)
    logger.info("✅ Strategy completed")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()