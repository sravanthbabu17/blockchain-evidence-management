// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AccidentEvidence {

    struct Record {
        string cid;
        string jsonHash;
        string vehicleId;
        uint256 timestamp;
        address uploadedBy;
    }

    Record[] public records;

    event RecordAdded(
        uint256 index,
        string cid,
        string jsonHash,
        string vehicleId,
        uint256 timestamp,
        address uploadedBy
    );

    function addEvidenceRecord(
        string memory _cid,
        string memory _jsonHash,
        string memory _vehicleId,
        uint256 _timestamp
    ) public {
        records.push(Record(
            _cid,
            _jsonHash,
            _vehicleId,
            _timestamp,
            msg.sender
        ));

        emit RecordAdded(
            records.length - 1,
            _cid,
            _jsonHash,
            _vehicleId,
            _timestamp,
            msg.sender
        );
    }

    function getRecord(uint256 index) public view returns (
        string memory,
        string memory,
        string memory,
        uint256,
        address
    ) {
        Record memory r = records[index];
        return (
            r.cid,
            r.jsonHash,
            r.vehicleId,
            r.timestamp,
            r.uploadedBy
        );
    }

    function getTotalRecords() public view returns (uint256) {
        return records.length;
    }
}