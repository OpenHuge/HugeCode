pub const COMMAND_CONSUMER_NAME_PREFIX: &str = "runtime-worker";

pub fn build_worker_lane_assignments(
    lane_count: usize,
    worker_concurrency: usize,
) -> Vec<Vec<usize>> {
    if lane_count == 0 || worker_concurrency == 0 {
        return Vec::new();
    }
    let worker_count = worker_concurrency.min(lane_count);
    let mut assignments = vec![Vec::new(); worker_count];
    for lane in 0..lane_count {
        assignments[lane % worker_count].push(lane);
    }
    assignments
}

pub fn lane_consumer_name(worker_index: usize, lane: usize) -> String {
    format!(
        "{COMMAND_CONSUMER_NAME_PREFIX}-{}-lane-{lane}",
        worker_index + 1
    )
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn assignments_cover_all_lanes_without_overlap() {
        let assignments = build_worker_lane_assignments(16, 4);
        assert_eq!(assignments.len(), 4);

        let mut lanes = HashSet::new();
        for worker_lanes in assignments {
            for lane in worker_lanes {
                assert!(lanes.insert(lane), "lane should not appear twice: {lane}");
            }
        }
        assert_eq!(lanes.len(), 16);
    }

    #[test]
    fn assignments_are_balanced_within_one_lane_difference() {
        let assignments = build_worker_lane_assignments(17, 4);
        let lane_counts = assignments
            .iter()
            .map(|lanes| lanes.len())
            .collect::<Vec<_>>();
        let min = lane_counts.iter().copied().min().unwrap_or(0);
        let max = lane_counts.iter().copied().max().unwrap_or(0);
        assert!(max - min <= 1, "lane assignments should be balanced");
    }

    #[test]
    fn assignments_cap_worker_count_to_lane_count() {
        let assignments = build_worker_lane_assignments(2, 8);
        assert_eq!(assignments.len(), 2);
        assert_eq!(assignments[0], vec![0]);
        assert_eq!(assignments[1], vec![1]);
    }

    #[test]
    fn lane_consumer_name_is_stable_and_human_readable() {
        assert_eq!(
            lane_consumer_name(0, 7),
            "runtime-worker-1-lane-7".to_string()
        );
        assert_eq!(
            lane_consumer_name(3, 15),
            "runtime-worker-4-lane-15".to_string()
        );
    }
}
