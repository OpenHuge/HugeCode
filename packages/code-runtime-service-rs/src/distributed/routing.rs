pub fn compute_workspace_lane(workspace_id: &str, lane_count: usize) -> usize {
    if lane_count == 0 {
        return 0;
    }
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in workspace_id.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    (hash as usize) % lane_count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_is_deterministic_for_same_workspace() {
        let lane_a = compute_workspace_lane("workspace-alpha", 16);
        let lane_b = compute_workspace_lane("workspace-alpha", 16);
        assert_eq!(lane_a, lane_b);
    }

    #[test]
    fn route_stays_in_lane_bounds() {
        for lane_count in [1usize, 2, 8, 16, 128] {
            let lane = compute_workspace_lane("workspace-beta", lane_count);
            assert!(lane < lane_count);
        }
    }
}
