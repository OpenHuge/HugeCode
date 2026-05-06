    fn find_sse_frame_boundary(buffer: &str) -> Option<(usize, usize)> {
        if let Some(index) = buffer.find("\r\n\r\n") {
            return Some((index, 4));
        }
        buffer.find("\n\n").map(|index| (index, 2))
    }

    fn parse_sse_json_frame(frame: &str) -> Option<Value> {
        let data_lines = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
            .collect::<Vec<_>>();
        if data_lines.is_empty() {
            return None;
        }
        serde_json::from_str::<Value>(data_lines.join("\n").as_str()).ok()
    }

    async fn read_sse_events(
        response: &mut reqwest::Response,
        expected_count: usize,
    ) -> Vec<Value> {
        let mut events = Vec::with_capacity(expected_count);
        let mut buffer = String::new();

        while events.len() < expected_count {
            let chunk = tokio::time::timeout(Duration::from_secs(5), response.chunk())
                .await
                .expect("timed out waiting for SSE event chunk")
                .expect("read SSE event chunk")
                .expect("SSE stream closed before expected events were received");
            buffer.push_str(
                std::str::from_utf8(chunk.as_ref()).expect("SSE event chunk should be UTF-8"),
            );

            while let Some((frame_end, delimiter_len)) = find_sse_frame_boundary(buffer.as_str()) {
                let frame = buffer[..frame_end].to_string();
                buffer = buffer[(frame_end + delimiter_len)..].to_string();
                if let Some(parsed) = parse_sse_json_frame(frame.as_str()) {
                    events.push(parsed);
                    if events.len() >= expected_count {
                        break;
                    }
                }
            }
        }

        events
    }

    async fn read_sse_events_until(
        response: &mut reqwest::Response,
        target_description: &str,
        mut stop_when: impl FnMut(&[Value]) -> bool,
    ) -> Vec<Value> {
        let mut events = Vec::new();
        let mut buffer = String::new();
        let deadline = Instant::now() + Duration::from_secs(15);

        loop {
            if stop_when(events.as_slice()) {
                return events;
            }
            if Instant::now() >= deadline {
                let observed_kinds = events
                    .iter()
                    .map(|event| {
                        event["kind"]
                            .as_str()
                            .unwrap_or("<unknown>")
                            .to_string()
                    })
                    .collect::<Vec<_>>();
                panic!(
                    "timed out waiting for {target_description} SSE events; observed kinds: {:?}",
                    observed_kinds
                );
            }
            let timeout_window = std::cmp::min(
                Duration::from_secs(5),
                deadline.saturating_duration_since(Instant::now()),
            );
            let chunk = match tokio::time::timeout(timeout_window, response.chunk()).await {
                Ok(chunk_result) => chunk_result
                    .expect("read SSE event chunk")
                    .expect("SSE stream closed before expected SSE events were received"),
                Err(_) => continue,
            };
            buffer.push_str(
                std::str::from_utf8(chunk.as_ref()).expect("SSE event chunk should be UTF-8"),
            );

            while let Some((frame_end, delimiter_len)) = find_sse_frame_boundary(buffer.as_str()) {
                let frame = buffer[..frame_end].to_string();
                buffer = buffer[(frame_end + delimiter_len)..].to_string();
                let Some(parsed) = parse_sse_json_frame(frame.as_str()) else {
                    continue;
                };
                events.push(parsed);
                if stop_when(events.as_slice()) {
                    return events;
                }
                if events.len() >= 64 {
                    panic!("received too many SSE events before {target_description}");
                }
            }
        }
    }

    async fn read_sse_events_until_turn_completed(
        response: &mut reqwest::Response,
        turn_id: &str,
    ) -> Vec<Value> {
        let target_turn_id = Value::String(turn_id.to_string());
        read_sse_events_until(response, "target turn.completed", move |events| {
            events.iter().any(|event| {
                event["kind"] == Value::String("turn.completed".to_string())
                    && event["payload"]["turnId"] == target_turn_id
            })
        })
        .await
    }
