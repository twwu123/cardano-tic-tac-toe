use cardano/address.{Address, Script}
use cardano/assets.{from_lovelace}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, placeholder,
}
use tic_tac_toe.{BoardState, CancelGame, ClaimWin, ProgressGame, validate_move}

const in_progress_board_state: BoardState =
  BoardState {
    cells: #[0, 1, 2, 0, 0, 0, 0, 0, 0],
    participant_x: #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
    participant_o: #"c2fc8d75b8129d68515de2d3fc51f80c7fccf1583a0c4bd515292465",
    current_turn: #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
    current_state: 1,
    bet_amount: 1000000,
    participant_o_bet: 1000000,
    participant_x_bet: 1000000,
  }

const starting_board_state: BoardState =
  BoardState {
    cells: #[0, 0, 0, 0, 0, 0, 0, 0, 0],
    participant_x: #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
    participant_o: #"c2fc8d75b8129d68515de2d3fc51f80c7fccf1583a0c4bd515292465",
    current_turn: #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
    current_state: 0,
    bet_amount: 1000000,
    participant_o_bet: 0,
    participant_x_bet: 0,
  }

const test_output_reference: OutputReference =
  OutputReference {
    transaction_id: #"b4f5c3d6e7f8901234567890abcdef1234567890abcdef1234567890abcdef12",
    output_index: 0,
  }

const test_script_address: Address =
  Address {
    payment_credential: Script(
      #"a80671690e277242c24c01f99367b72d4316274dd764ed22b6615de4",
    ),
    stake_credential: None,
  }

test fail_when_cancelling_wrong_state() fail {
  let in_progress_transaction: Transaction =
    Transaction {
      ..placeholder,
      inputs: [
        Input {
          output_reference: test_output_reference,
          output: Output {
            address: test_script_address,
            value: from_lovelace(2000000),
            datum: InlineDatum(in_progress_board_state),
            reference_script: None,
          },
        },
      ],
      outputs: [],
    }

  tic_tac_toe.tic_tac_toe.spend(
    Some(in_progress_board_state),
    CancelGame,
    test_output_reference,
    in_progress_transaction,
  )
}

test succeed_when_starting_game() {
  let start_game_transaction: Transaction =
    Transaction {
      ..placeholder,
      inputs: [
        Input {
          output_reference: test_output_reference,
          output: Output {
            address: test_script_address,
            value: from_lovelace(2000000),
            datum: InlineDatum(starting_board_state),
            reference_script: None,
          },
        },
      ],
      outputs: [
        Output {
          address: test_script_address,
          value: from_lovelace(2000000),
          datum: InlineDatum(
            BoardState { ..starting_board_state, current_state: 1 },
          ),
          reference_script: None,
        },
      ],
    }

  tic_tac_toe.tic_tac_toe.spend(
    Some(starting_board_state),
    CancelGame,
    test_output_reference,
    start_game_transaction,
  )
}

test succeed_when_valid_win_game() {
  let win_game_transaction: Transaction =
    Transaction {
      ..placeholder,
      inputs: [
        Input {
          output_reference: test_output_reference,
          output: Output {
            address: test_script_address,
            value: from_lovelace(2000000),
            datum: InlineDatum(
              BoardState {
                ..in_progress_board_state,
                cells: #[0, 1, 1, 2, 2, 0, 0, 0, 0],
                current_state: 1,
              },
            ),
            reference_script: None,
          },
        },
      ],
      outputs: [
        Output {
          address: test_script_address,
          value: from_lovelace(2000000),
          datum: InlineDatum(
            BoardState {
              ..in_progress_board_state,
              cells: #[1, 1, 1, 2, 2, 0, 0, 0, 0],
              current_turn: #"c2fc8d75b8129d68515de2d3fc51f80c7fccf1583a0c4bd515292465",
              current_state: 2,
            },
          ),
          reference_script: None,
        },
      ],
      extra_signatories: [
        #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
      ],
    }

  tic_tac_toe.tic_tac_toe.spend(
    Some(
      BoardState {
        ..in_progress_board_state,
        cells: #[0, 1, 1, 2, 2, 0, 0, 0, 0],
        current_state: 1,
      },
    ),
    ProgressGame(
      ClaimWin {
        position: 0,
        player: #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
        winning_indices: [0, 1, 2],
      },
    ),
    test_output_reference,
    win_game_transaction,
  )
}

test succeed_validate_valid_move() {
  validate_move(
    in_progress_board_state,
    BoardState {
      ..in_progress_board_state,
      cells: #[0, 1, 2, 1, 0, 0, 0, 0, 0],
      current_turn: #"c2fc8d75b8129d68515de2d3fc51f80c7fccf1583a0c4bd515292465",
    },
    3,
    #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
    1,
  )
}

test fail_validate_invalid_move() fail {
  validate_move(
    in_progress_board_state,
    BoardState {
      ..in_progress_board_state,
      cells: #[0, 1, 1, 0, 0, 0, 0, 0, 0],
      current_turn: #"c2fc8d75b8129d68515de2d3fc51f80c7fccf1583a0c4bd515292465",
    },
    1,
    #"ae6b724851461d779a9b8c8a6785203d130ac54022f111ec3afd4e33",
    1,
  )
}
