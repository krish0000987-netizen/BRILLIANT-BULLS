--
-- PostgreSQL database dump
--

\restrict WPOysagRb78oIZdphOQ1bvb7fti4LXLO4iww9MkJ1F7IuxCR5W3QF3zA32cumnT

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: algo_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.algo_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying,
    run_id character varying,
    level character varying NOT NULL,
    message text NOT NULL,
    logged_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.algo_logs OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying,
    action text NOT NULL,
    category text NOT NULL,
    details text,
    ip_address text,
    user_agent text,
    severity text DEFAULT 'info'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: csv_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.csv_configs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    file_name text NOT NULL,
    encrypted_content text NOT NULL,
    iv text NOT NULL,
    auth_tag text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.csv_configs OWNER TO postgres;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.devices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    device_fingerprint text NOT NULL,
    browser_name text,
    browser_version text,
    os_name text,
    os_version text,
    ip_address text,
    country text,
    city text,
    is_trusted boolean DEFAULT false NOT NULL,
    last_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.devices OWNER TO postgres;

--
-- Name: encrypted_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.encrypted_credentials (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    credential_type text NOT NULL,
    encrypted_value text NOT NULL,
    iv text NOT NULL,
    auth_tag text NOT NULL,
    label text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.encrypted_credentials OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    plan character varying DEFAULT 'trial'::character varying NOT NULL,
    status character varying DEFAULT 'inactive'::character varying NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    trial_started_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username character varying NOT NULL,
    password text NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    phone character varying,
    role character varying DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: algo_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.algo_logs (id, user_id, run_id, level, message, logged_at) FROM stdin;
468d00d3-afdb-4ba6-b285-b8e4d2aae196	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM (Mon-Fri IST)	2026-03-17 09:18:51.030394
397c7ebc-0b08-4915-8b1a-b8ce735c5854	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM (Mon-Fri IST)	2026-03-17 09:31:43.618561
9bd847f6-f8bd-4917-894f-0ad320779f86	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM (Mon-Fri IST)	2026-03-17 09:35:08.813012
d6ec30d1-3463-42a3-a515-09ec17358111	\N	\N	info	[SCHEDULER] Auto-stopping algorithm at 3:10 PM IST	2026-03-17 09:40:00.018695
f53e3e3a-b62c-4804-9f6a-c8b1a38d86ae	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM (Mon-Fri IST)	2026-03-17 09:50:41.963588
459b0a6c-afe4-4f07-8a91-32dc7d8ca9b4	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM (Mon-Fri IST)	2026-03-17 10:04:38.802214
65816abc-4172-4b8a-8d41-e73d7a2ee100	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM (Mon-Fri IST)	2026-03-17 10:13:05.76467
62cc017c-6a95-4631-8630-f638022eb7e2	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:30 PM, CSV Delete 3:35 PM (Mon-Fri IST)	2026-03-17 10:23:28.28248
14a5b5ca-7854-47fb-bebb-f0bf580fd786	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Stop 3:30 PM, CSV Delete 3:35 PM (Mon-Fri IST)	2026-03-17 10:52:04.04253
5f4616b4-34a8-442b-bf34-2b3c6f8c3fbb	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 10:55:45.141635
5df3059d-0c89-4219-ad98-37b5ef837147	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 11:18:08.982659
c8bcb76f-8986-43a9-bccb-b2102b4eca01	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 11:24:47.430008
fb16799c-33cb-4450-987a-7433a3f7d14c	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 11:36:03.842016
30ee7591-c336-4ab9-ad3f-355c579c3e36	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 11:45:39.343203
f3a21b24-cfcf-4eed-a74c-8dc6e4ae49e9	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 11:48:36.584622
2c941d44-4f77-408b-bac9-47589c209e58	\N	\N	info	Scheduled jobs configured: Live Start 8:45 AM, Test Start 9:30 AM, Auto-stop 3:30 PM (Mon-Fri IST)	2026-03-17 14:20:13.768937
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, category, details, ip_address, user_agent, severity, created_at) FROM stdin;
\.


--
-- Data for Name: csv_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.csv_configs (id, user_id, file_name, encrypted_content, iv, auth_tag, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.devices (id, user_id, device_fingerprint, browser_name, browser_version, os_name, os_version, ip_address, country, city, is_trusted, last_seen_at, created_at) FROM stdin;
\.


--
-- Data for Name: encrypted_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.encrypted_credentials (id, user_id, credential_type, encrypted_value, iv, auth_tag, label, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
a0PNlfa10r_dGkR9wlvd1D-0ZY9HV3RA	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-24T09:28:58.297Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "userId": "0139a37a-641d-45f6-931c-f83628fa1a8c"}	2026-03-24 09:28:59
wdafJ3ja6dWzVcmj--nv5Se3Oyc_YiRu	{"cookie": {"path": "/", "secure": false, "expires": "2026-03-24T09:49:25.163Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "userId": "0139a37a-641d-45f6-931c-f83628fa1a8c"}	2026-03-24 09:49:26
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, user_id, plan, status, amount, start_date, end_date, trial_started_at, cancelled_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, email, first_name, last_name, phone, role, is_active, created_at, updated_at) FROM stdin;
0139a37a-641d-45f6-931c-f83628fa1a8c	akshay	$2b$10$7RZkz2x3WXKjKne.h6/k8OyLTq9//QE.5zbbUuLTLIrghUOTJW/Uu	\N	\N	\N	\N	admin	t	2026-03-17 09:18:45.813141	2026-03-17 09:18:45.813141
\.


--
-- Name: algo_logs algo_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.algo_logs
    ADD CONSTRAINT algo_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: csv_configs csv_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.csv_configs
    ADD CONSTRAINT csv_configs_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: encrypted_credentials encrypted_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encrypted_credentials
    ADD CONSTRAINT encrypted_credentials_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: algo_logs algo_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.algo_logs
    ADD CONSTRAINT algo_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: csv_configs csv_configs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.csv_configs
    ADD CONSTRAINT csv_configs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: devices devices_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: encrypted_credentials encrypted_credentials_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encrypted_credentials
    ADD CONSTRAINT encrypted_credentials_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict WPOysagRb78oIZdphOQ1bvb7fti4LXLO4iww9MkJ1F7IuxCR5W3QF3zA32cumnT

